"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registry = exports.AdapterRegistry = void 0;
const ThreeDAnalyticsAdapter_1 = require("./ThreeDAnalyticsAdapter");
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
class AdapterRegistry {
    constructor(adapters) {
        this.adapters = new Map();
        for (const adapter of adapters) {
            this.register(adapter);
        }
    }
    register(adapter) {
        if (this.adapters.has(adapter.platformId)) {
            throw new Error(`Adapter with platformId "${adapter.platformId}" is already registered.`);
        }
        this.adapters.set(adapter.platformId, adapter);
    }
    get(platformId) {
        return this.adapters.get(platformId);
    }
    getAll() {
        return Array.from(this.adapters.values());
    }
    listPlatformIds() {
        return Array.from(this.adapters.keys());
    }
}
exports.AdapterRegistry = AdapterRegistry;
/**
 * Pre-built registry wired with the adapters available in Phase 1.
 * Import this instance wherever adapter access is needed.
 */
exports.registry = new AdapterRegistry([new ThreeDAnalyticsAdapter_1.ThreeDAnalyticsAdapter()]);
//# sourceMappingURL=AdapterRegistry.js.map