import { BaseAdapter } from './BaseAdapter';
import { Chart, ChartFilterOptions, ChartSummary, ChartType, PlatformInfo } from '../types/chart.types';
/**
 * ThreeDAnalyticsAdapter reads chart data from the local 3danalytics.json file.
 *
 * The JSON is a flat array of chart objects that form a 4-level hierarchy via
 * parentId references and semantic metadata (processStep, segment, detailLevel).
 *
 * In a real integration this adapter would authenticate against the 3DAnalytics
 * API and translate its response schema into the engine's canonical Chart type.
 */
export declare class ThreeDAnalyticsAdapter extends BaseAdapter {
    readonly platformId = "3danalytics";
    private readonly dataFilePath;
    private cachedCharts;
    constructor(dataFilePath?: string);
    private loadCharts;
    private toSummary;
    private applyFilters;
    getPlatformInfo(): Promise<PlatformInfo>;
    listCharts(filters?: ChartFilterOptions): Promise<ChartSummary[]>;
    getChartById(chartId: string): Promise<Chart | null>;
    /** Override BaseAdapter to use a single-pass filter instead of two round-trips */
    getChildren(chartId: string): Promise<Chart[]>;
    /** Convenience: return all distinct chartTypes present in the dataset */
    listChartTypes(): Promise<ChartType[]>;
}
//# sourceMappingURL=ThreeDAnalyticsAdapter.d.ts.map