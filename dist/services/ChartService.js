"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChartService = void 0;
/**
 * ChartService is the application-level facade that sits between the HTTP layer
 * and the adapter layer. Controllers should never talk directly to adapters—
 * they go through ChartService so that cross-cutting concerns (logging, caching,
 * auth) can be added in one place later.
 */
class ChartService {
    constructor(registry) {
        this.registry = registry;
    }
    // ── Platform operations ──────────────────────────────────────────────────
    async listPlatforms() {
        return Promise.all(this.registry.getAll().map((a) => a.getPlatformInfo()));
    }
    async getPlatformInfo(platformId) {
        const adapter = this.registry.get(platformId);
        if (!adapter)
            return null;
        return adapter.getPlatformInfo();
    }
    // ── Chart listing (summaries) ────────────────────────────────────────────
    /**
     * Returns chart summaries for the given platform.
     * Returns null if the platform is not registered.
     * Accepts optional semantic filters: detailLevel, processStep, segment, parentId, chartType.
     */
    async listCharts(platformId, filters) {
        const adapter = this.registry.get(platformId);
        if (!adapter)
            return null;
        return adapter.listCharts(filters);
    }
    // ── Individual chart ─────────────────────────────────────────────────────
    /**
     * Returns the full chart (with data payload) for the given id.
     * Returns null if the platform is not registered or the chart does not exist.
     */
    async getChart(platformId, chartId) {
        const adapter = this.registry.get(platformId);
        if (!adapter)
            return null;
        return adapter.getChartById(chartId);
    }
    // ── Hierarchy ────────────────────────────────────────────────────────────
    /**
     * Returns the direct children of chartId in the hierarchy.
     * Returns null if the platform is not registered.
     */
    async getChildren(platformId, chartId) {
        const adapter = this.registry.get(platformId);
        if (!adapter)
            return null;
        return adapter.getChildren(chartId);
    }
}
exports.ChartService = ChartService;
//# sourceMappingURL=ChartService.js.map