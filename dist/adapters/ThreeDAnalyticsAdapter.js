"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThreeDAnalyticsAdapter = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const BaseAdapter_1 = require("./BaseAdapter");
/**
 * ThreeDAnalyticsAdapter reads chart data from the local 3danalytics.json file.
 *
 * The JSON is a flat array of chart objects that form a 4-level hierarchy via
 * parentId references and semantic metadata (processStep, segment, detailLevel).
 *
 * In a real integration this adapter would authenticate against the 3DAnalytics
 * API and translate its response schema into the engine's canonical Chart type.
 */
class ThreeDAnalyticsAdapter extends BaseAdapter_1.BaseAdapter {
    constructor(dataFilePath) {
        super();
        this.platformId = '3danalytics';
        this.cachedCharts = null;
        this.dataFilePath =
            dataFilePath ?? path.resolve(process.cwd(), '3danalytics.json');
        this.metadataFilePath = path.resolve(process.cwd(), 'metadata.json');
    }
    // ── Private helpers ────────────────────────────────────────────────────────
    loadCharts() {
        if (this.cachedCharts) {
            return this.cachedCharts;
        }
        if (!fs.existsSync(this.dataFilePath)) {
            throw new Error(`3DAnalytics data file not found at: ${this.dataFilePath}`);
        }
        const raw = fs.readFileSync(this.dataFilePath, 'utf-8');
        this.cachedCharts = JSON.parse(raw);
        return this.cachedCharts;
    }
    toSummary(chart) {
        const { id, title, chartType, size, semantic, processLabel, parentId, segmentLabel, } = chart;
        return {
            id,
            title,
            chartType,
            size,
            semantic,
            processLabel,
            parentId,
            segmentLabel,
        };
    }
    applyFilters(charts, filters) {
        return charts.filter((c) => {
            if (filters.detailLevel !== undefined &&
                c.semantic.detailLevel !== filters.detailLevel) {
                return false;
            }
            if (filters.processStep !== undefined &&
                c.semantic.processStep !== filters.processStep) {
                return false;
            }
            if (filters.segment !== undefined) {
                // Callers pass -1 to explicitly request charts with no segment (null)
                const wantNull = filters.segment === -1;
                if (wantNull && c.semantic.segment !== null)
                    return false;
                if (!wantNull && c.semantic.segment !== filters.segment)
                    return false;
            }
            if (filters.parentId !== undefined && c.parentId !== filters.parentId) {
                return false;
            }
            if (filters.chartType !== undefined &&
                c.chartType !== filters.chartType) {
                return false;
            }
            return true;
        });
    }
    // ── IChartAdapter implementation ───────────────────────────────────────────
    async getPlatformInfo() {
        return {
            id: this.platformId,
            name: '3DAnalytics',
            description: 'File-based SaaS analytics adapter serving hierarchical chart data from a local JSON store. ' +
                'Replace file I/O with live API calls when integrating against the real 3DAnalytics platform.',
            version: '1.0.0',
        };
    }
    async listCharts(filters) {
        const charts = this.loadCharts();
        const filtered = filters ? this.applyFilters(charts, filters) : charts;
        return filtered.map((c) => this.toSummary(c));
    }
    async getChartById(chartId) {
        const charts = this.loadCharts();
        return charts.find((c) => c.id === chartId) ?? null;
    }
    /** Override BaseAdapter to use a single-pass filter instead of two round-trips */
    async getChildren(chartId) {
        const charts = this.loadCharts();
        return charts.filter((c) => c.parentId === chartId);
    }
    /** Convenience: return all distinct chartTypes present in the dataset */
    async listChartTypes() {
        const charts = this.loadCharts();
        return [...new Set(charts.map((c) => c.chartType))];
    }
    async getMetadata() {
        if (!fs.existsSync(this.metadataFilePath)) {
            return null;
        }
        const raw = fs.readFileSync(this.metadataFilePath, 'utf-8');
        return JSON.parse(raw);
    }
}
exports.ThreeDAnalyticsAdapter = ThreeDAnalyticsAdapter;
//# sourceMappingURL=ThreeDAnalyticsAdapter.js.map