import { AdapterRegistry } from '../adapters/AdapterRegistry';
import {
  Chart,
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

  // ── Chart listing (summaries) ────────────────────────────────────────────

  /**
   * Returns chart summaries for the given platform.
   * Returns null if the platform is not registered.
   * Accepts optional semantic filters: detailLevel, processStep, segment, parentId, chartType.
   */
  async listCharts(
    platformId: string,
    filters?: ChartFilterOptions
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

  // ── Hierarchy ────────────────────────────────────────────────────────────

  /**
   * Returns the direct children of chartId in the hierarchy.
   * Returns null if the platform is not registered.
   */
  async getChildren(
    platformId: string,
    chartId: string
  ): Promise<Chart[] | null> {
    const adapter = this.registry.get(platformId);
    if (!adapter) return null;
    return adapter.getChildren(chartId);
  }
}
