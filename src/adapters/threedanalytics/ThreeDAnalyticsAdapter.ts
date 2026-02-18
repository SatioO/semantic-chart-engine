import * as fs from 'fs';
import * as path from 'path';
import { BaseAdapter } from '../BaseAdapter';
import {
  Chart,
  ChartFilterOptions,
  ChartSummary,
  ChartType,
  PlatformInfo,
} from '../../types/chart.types';

/**
 * ThreeDAnalyticsAdapter reads chart data from the local 3danalytics.json file.
 *
 * The JSON is a flat array of chart objects that form a 4-level hierarchy via
 * parentId references and semantic metadata (processStep, segment, detailLevel).
 *
 * In a real integration this adapter would authenticate against the 3DAnalytics
 * API and translate its response schema into the engine's canonical Chart type.
 */
export class ThreeDAnalyticsAdapter extends BaseAdapter {
  readonly platformId = '3danalytics';

  private readonly dataFilePath: string;
  private readonly metadataFilePath: string;
  private cachedCharts: Chart[] | null = null;

  constructor(dataFilePath?: string) {
    super();
    this.dataFilePath =
      dataFilePath ?? path.join(__dirname, '3danalytics.json');
    this.metadataFilePath = path.join(__dirname, 'metadata.json');
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private loadCharts(): Chart[] {
    if (this.cachedCharts) {
      return this.cachedCharts;
    }

    if (!fs.existsSync(this.dataFilePath)) {
      throw new Error(
        `3DAnalytics data file not found at: ${this.dataFilePath}`,
      );
    }

    const raw = fs.readFileSync(this.dataFilePath, 'utf-8');
    this.cachedCharts = JSON.parse(raw) as Chart[];
    return this.cachedCharts;
  }

  private toSummary(chart: Chart): ChartSummary {
    const {
      id,
      title,
      chartType,
      size,
      semantic,
      processLabel,
      parentId,
      segmentLabel,
    } = chart;
    return {
      id,
      title,
      chartType,
      size,
      semantic,
      processLabel,
      parentId,
      segmentLabel,
    };
  }

  private applyFilters(charts: Chart[], filters: ChartFilterOptions): Chart[] {
    return charts.filter((c) => {
      if (
        filters.detailLevel !== undefined &&
        c.semantic.detailLevel !== filters.detailLevel
      ) {
        return false;
      }
      if (
        filters.processStep !== undefined &&
        c.semantic.processStep !== filters.processStep
      ) {
        return false;
      }
      if (filters.segment !== undefined) {
        // Callers pass -1 to explicitly request charts with no segment (null)
        const wantNull = filters.segment === -1;
        if (wantNull && c.semantic.segment !== null) return false;
        if (!wantNull && c.semantic.segment !== filters.segment) return false;
      }
      if (filters.parentId !== undefined && c.parentId !== filters.parentId) {
        return false;
      }
      if (
        filters.chartType !== undefined &&
        c.chartType !== filters.chartType
      ) {
        return false;
      }
      return true;
    });
  }

  // ── IChartAdapter implementation ───────────────────────────────────────────

  async getPlatformInfo(): Promise<PlatformInfo> {
    return {
      id: this.platformId,
      name: '3DAnalytics',
      description:
        'File-based SaaS analytics adapter serving hierarchical chart data from a local JSON store. ' +
        'Replace file I/O with live API calls when integrating against the real 3DAnalytics platform.',
      version: '1.0.0',
    };
  }

  async listCharts(filters?: ChartFilterOptions): Promise<ChartSummary[]> {
    const charts = this.loadCharts();
    const filtered = filters ? this.applyFilters(charts, filters) : charts;
    return filtered.map((c) => this.toSummary(c));
  }

  async getChartById(chartId: string): Promise<Chart | null> {
    const charts = this.loadCharts();
    return charts.find((c) => c.id === chartId) ?? null;
  }

  /** Override BaseAdapter to use a single-pass filter instead of two round-trips */
  async getChildren(chartId: string): Promise<Chart[]> {
    const charts = this.loadCharts();
    return charts.filter((c) => c.parentId === chartId);
  }

  /** Convenience: return all distinct chartTypes present in the dataset */
  async listChartTypes(): Promise<ChartType[]> {
    const charts = this.loadCharts();
    return [...new Set(charts.map((c) => c.chartType))];
  }

  async getMetadata(): Promise<any> {
    if (!fs.existsSync(this.metadataFilePath)) {
      return null;
    }
    const raw = fs.readFileSync(this.metadataFilePath, 'utf-8');
    return JSON.parse(raw);
  }
}
