import { AdapterRegistry } from '../adapters/AdapterRegistry';
import {
  Chart,
  ChartDataEssentials,
  ChartFilterOptions,
  ChartSummary,
  PlatformInfo,
} from '../types/chart.types';

/**
 * ChartService is the application-level facade that sits between the HTTP layer
 * and the adapter layer. Controllers should never talk directly to adapters—
 * they go through ChartService so that cross-cutting concerns (logging, caching,
 * auth) can be added in one place later.
 */
export class ChartService {
  constructor(private readonly registry: AdapterRegistry) {}

  // ── Platform operations ──────────────────────────────────────────────────

  async listPlatforms(): Promise<PlatformInfo[]> {
    return Promise.all(this.registry.getAll().map((a) => a.getPlatformInfo()));
  }

  async getPlatformInfo(platformId: string): Promise<PlatformInfo | null> {
    const adapter = this.registry.get(platformId);
    if (!adapter) return null;
    return adapter.getPlatformInfo();
  }

  async getPlatformMetadata(platformId: string): Promise<any | null> {
    const adapter = this.registry.get(platformId);
    if (!adapter) return null;
    if (adapter.getMetadata) {
      return adapter.getMetadata();
    }
    return null;
  }

  // ── Chart listing (summaries) ────────────────────────────────────────────

  /**
   * Returns chart summaries for the given platform.
   * Returns null if the platform is not registered.
   * Accepts optional semantic filters: detailLevel, processStep, segment, parentId, chartType.
   */
  async listCharts(
    platformId: string,
    filters?: ChartFilterOptions,
  ): Promise<ChartSummary[] | null> {
    const adapter = this.registry.get(platformId);
    if (!adapter) return null;
    return adapter.listCharts(filters);
  }

  // ── Individual chart ─────────────────────────────────────────────────────

  /**
   * Returns the full chart (with data payload) for the given id.
   * Returns null if the platform is not registered or the chart does not exist.
   */
  async getChart(platformId: string, chartId: string): Promise<Chart | null> {
    const adapter = this.registry.get(platformId);
    if (!adapter) return null;
    return adapter.getChartById(chartId);
  }

  /**
   * Returns only the data array for a given chart id.
   * Returns null if the platform is not registered or the chart does not exist.
   */
  async getChartData(
    platformId: string,
    chartId: string,
  ): Promise<Chart['data'] | null> {
    const chart = await this.getChart(platformId, chartId);
    if (!chart) return null;
    return chart.data;
  }

  /**
   * Returns essential chart info (id, title, chartType, data) without semantic metadata.
   * Returns null if the platform is not registered or the chart does not exist.
   */
  async getChartDataEssentials(
    platformId: string,
    chartId: string,
  ): Promise<ChartDataEssentials | null> {
    const chart = await this.getChart(platformId, chartId);
    if (!chart) return null;
    return {
      id: chart.id,
      title: chart.title,
      chartType: chart.chartType,
      data: chart.data,
    };
  }

  // ── Hierarchy ────────────────────────────────────────────────────────────

  /**
   * Returns the direct children of chartId in the hierarchy.
   * Returns null if the platform is not registered.
   */
  async getChildren(
    platformId: string,
    chartId: string,
  ): Promise<Chart[] | null> {
    const adapter = this.registry.get(platformId);
    if (!adapter) return null;
    return adapter.getChildren(chartId);
  }
}
