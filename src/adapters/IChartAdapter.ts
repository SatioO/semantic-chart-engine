import {
  Chart,
  ChartFilterOptions,
  ChartSummary,
  PlatformInfo,
} from '../types/chart.types';

/**
 * IChartAdapter defines the contract that every platform adapter must implement.
 *
 * To integrate a new charting platform (e.g. Power BI, Tableau, Looker):
 *  1. Create a class that implements this interface
 *  2. Register it in AdapterRegistry
 *
 * All methods are async to support future adapters that make real network calls.
 */
export interface IChartAdapter {
  /** Unique identifier for this platform (e.g. "powerbi", "tableau", "3danalytics") */
  readonly platformId: string;

  /** Human-readable metadata about the platform */
  getPlatformInfo(): Promise<PlatformInfo>;

  /**
   * Returns a lightweight list of all available charts (no dataset payloads).
   * Pass an optional filter to narrow results by semantic metadata, parentId, or chartType.
   */
  listCharts(filters?: ChartFilterOptions): Promise<ChartSummary[]>;

  /** Returns the full chart including dataset payload for the given chart ID */
  getChartById(chartId: string): Promise<Chart | null>;

  /** Returns the direct children of a given chart in the hierarchy */
  getChildren(chartId: string): Promise<Chart[]>;

  /** Returns platform-specific metadata if available */
  getMetadata?(): Promise<any>;
}
