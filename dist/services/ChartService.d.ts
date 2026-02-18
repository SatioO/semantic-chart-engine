import { AdapterRegistry } from '../adapters/AdapterRegistry';
import { Chart, ChartFilterOptions, ChartSummary, PlatformInfo } from '../types/chart.types';
/**
 * ChartService is the application-level facade that sits between the HTTP layer
 * and the adapter layer. Controllers should never talk directly to adapters—
 * they go through ChartService so that cross-cutting concerns (logging, caching,
 * auth) can be added in one place later.
 */
export declare class ChartService {
    private readonly registry;
    constructor(registry: AdapterRegistry);
    listPlatforms(): Promise<PlatformInfo[]>;
    getPlatformInfo(platformId: string): Promise<PlatformInfo | null>;
    /**
     * Returns chart summaries for the given platform.
     * Returns null if the platform is not registered.
     * Accepts optional semantic filters: detailLevel, processStep, segment, parentId, chartType.
     */
    listCharts(platformId: string, filters?: ChartFilterOptions): Promise<ChartSummary[] | null>;
    /**
     * Returns the full chart (with data payload) for the given id.
     * Returns null if the platform is not registered or the chart does not exist.
     */
    getChart(platformId: string, chartId: string): Promise<Chart | null>;
    /**
     * Returns the direct children of chartId in the hierarchy.
     * Returns null if the platform is not registered.
     */
    getChildren(platformId: string, chartId: string): Promise<Chart[] | null>;
}
//# sourceMappingURL=ChartService.d.ts.map