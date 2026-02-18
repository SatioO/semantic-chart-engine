"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseAdapter = void 0;
/**
 * BaseAdapter provides a default in-memory implementation of getChildren so
 * concrete adapters only need to implement the core data-fetching methods.
 *
 * Concrete adapters should override getChildren if the upstream platform
 * supports native hierarchical queries.
 */
class BaseAdapter {
    /**
     * Default implementation filters listCharts results by parentId.
     * Returns full Chart objects so callers get the data payload.
     */
    async getChildren(chartId) {
        const summaries = await this.listCharts({ parentId: chartId });
        const charts = await Promise.all(summaries.map((s) => this.getChartById(s.id)));
        return charts.filter((c) => c !== null);
    }
}
exports.BaseAdapter = BaseAdapter;
//# sourceMappingURL=BaseAdapter.js.map