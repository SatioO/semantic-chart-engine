import { IChartAdapter } from './IChartAdapter';
/**
 * AdapterRegistry is the single source of truth for all registered platform adapters.
 *
 * Adding a new platform (e.g. Power BI, Tableau):
 *  1. Implement IChartAdapter (extend BaseAdapter for convenience)
 *  2. Import and instantiate the adapter below
 *  3. Pass it to the AdapterRegistry constructor
 *
 * The registry is a singleton—create one instance and share it across the app.
 */
export declare class AdapterRegistry {
    private readonly adapters;
    constructor(adapters: IChartAdapter[]);
    register(adapter: IChartAdapter): void;
    get(platformId: string): IChartAdapter | undefined;
    getAll(): IChartAdapter[];
    listPlatformIds(): string[];
}
/**
 * Pre-built registry wired with the adapters available in Phase 1.
 * Import this instance wherever adapter access is needed.
 */
export declare const registry: AdapterRegistry;
//# sourceMappingURL=AdapterRegistry.d.ts.map