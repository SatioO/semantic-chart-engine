import { IChartAdapter } from './IChartAdapter';
import { Chart, ChartFilterOptions, ChartSummary, PlatformInfo } from '../types/chart.types';
/**
 * BaseAdapter provides a default in-memory implementation of getChildren so
 * concrete adapters only need to implement the core data-fetching methods.
 *
 * Concrete adapters should override getChildren if the upstream platform
 * supports native hierarchical queries.
 */
export declare abstract class BaseAdapter implements IChartAdapter {
    abstract readonly platformId: string;
    abstract getPlatformInfo(): Promise<PlatformInfo>;
    abstract listCharts(filters?: ChartFilterOptions): Promise<ChartSummary[]>;
    abstract getChartById(chartId: string): Promise<Chart | null>;
    /**
     * Default implementation filters listCharts results by parentId.
     * Returns full Chart objects so callers get the data payload.
     */
    getChildren(chartId: string): Promise<Chart[]>;
}
//# sourceMappingURL=BaseAdapter.d.ts.map