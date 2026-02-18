import { IChartAdapter } from './IChartAdapter';
import { ThreeDAnalyticsAdapter } from './ThreeDAnalyticsAdapter';

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
export class AdapterRegistry {
  private readonly adapters = new Map<string, IChartAdapter>();

  constructor(adapters: IChartAdapter[]) {
    for (const adapter of adapters) {
      this.register(adapter);
    }
  }

  register(adapter: IChartAdapter): void {
    if (this.adapters.has(adapter.platformId)) {
      throw new Error(
        `Adapter with platformId "${adapter.platformId}" is already registered.`
      );
    }
    this.adapters.set(adapter.platformId, adapter);
  }

  get(platformId: string): IChartAdapter | undefined {
    return this.adapters.get(platformId);
  }

  getAll(): IChartAdapter[] {
    return Array.from(this.adapters.values());
  }

  listPlatformIds(): string[] {
    return Array.from(this.adapters.keys());
  }
}

/**
 * Pre-built registry wired with the adapters available in Phase 1.
 * Import this instance wherever adapter access is needed.
 */
export const registry = new AdapterRegistry([new ThreeDAnalyticsAdapter()]);
