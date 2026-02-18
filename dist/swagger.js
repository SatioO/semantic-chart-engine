"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.swaggerSpec = void 0;
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
const path_1 = __importDefault(require("path"));
const options = {
    definition: {
        openapi: '3.0.3',
        info: {
            title: 'Semantic Chart Engine API',
            version: '1.0.0',
            description: 'A generic charting engine with a pluggable adapter pattern. ' +
                'Phase 1 ships a **3DAnalytics** adapter that serves a hierarchical SaaS dashboard ' +
                'from a local JSON store. Future adapters (Power BI, Tableau, Looker, …) implement ' +
                'the same `IChartAdapter` contract and register in `AdapterRegistry`.',
            contact: {
                name: 'VR Frame',
            },
        },
        servers: [{ url: 'http://localhost:3000', description: 'Local development server' }],
        tags: [
            { name: 'Health', description: 'Server health and discovery' },
            { name: 'Platforms', description: 'Registered adapter platforms' },
            { name: 'Charts', description: 'Chart data and hierarchy navigation' },
        ],
        components: {
            schemas: {
                // ── Primitives ────────────────────────────────────────────────────
                ChartType: {
                    type: 'string',
                    enum: ['kpi', 'bar', 'funnel', 'revenue', 'churn'],
                    description: '`kpi` – headline metrics | `bar` – categorical bar chart | ' +
                        '`funnel` – conversion funnel | `revenue` – MRR/ARR over time | ' +
                        '`churn` – churn-rate time series',
                },
                TrendDirection: {
                    type: 'string',
                    enum: ['up', 'down', 'flat'],
                },
                ChartSize: {
                    type: 'object',
                    required: ['width', 'height'],
                    properties: {
                        width: { type: 'number', example: 4 },
                        height: { type: 'number', example: 2.5 },
                    },
                },
                SemanticMeta: {
                    type: 'object',
                    required: ['processStep', 'segment', 'detailLevel'],
                    properties: {
                        processStep: {
                            type: 'integer',
                            minimum: 0,
                            maximum: 4,
                            description: '0 = Marketing | 1 = Leads | 2 = Pipeline | 3 = Revenue | 4 = Retention',
                            example: 2,
                        },
                        segment: {
                            type: 'integer',
                            nullable: true,
                            description: 'null = cross-segment overview | 0 = Startup | 1 = SMB | 2 = Enterprise',
                            example: 0,
                        },
                        detailLevel: {
                            type: 'integer',
                            minimum: 0,
                            maximum: 3,
                            description: '0 = Overview (root) | 1 = Process | 2 = Segment | 3 = Detail',
                            example: 2,
                        },
                    },
                },
                // ── Data item shapes per chartType ────────────────────────────────
                KpiDataItem: {
                    type: 'object',
                    required: ['label', 'value', 'unit', 'trend', 'trendDirection'],
                    properties: {
                        label: { type: 'string', example: 'Marketing Spend' },
                        value: { type: 'number', example: 285000 },
                        unit: { type: 'string', example: '$' },
                        trend: { type: 'number', example: 15.2 },
                        trendDirection: { $ref: '#/components/schemas/TrendDirection' },
                    },
                },
                BarDataItem: {
                    type: 'object',
                    required: ['product', 'revenue', 'growth'],
                    properties: {
                        product: { type: 'string', example: 'Startup' },
                        revenue: { type: 'number', example: 138368 },
                        growth: { type: 'number', example: 18.8 },
                    },
                },
                FunnelDataItem: {
                    type: 'object',
                    required: ['stage', 'count', 'conversionRate'],
                    properties: {
                        stage: { type: 'string', example: 'Sign-ups' },
                        count: { type: 'integer', example: 4100 },
                        conversionRate: { type: 'number', example: 15.8 },
                    },
                },
                RevenueDataItem: {
                    type: 'object',
                    required: ['month', 'mrr', 'arr', 'newRevenue', 'churnedRevenue'],
                    properties: {
                        month: { type: 'string', example: 'Jan' },
                        mrr: { type: 'number', example: 24403 },
                        arr: { type: 'number', example: 292836 },
                        newRevenue: { type: 'number', example: 3732 },
                        churnedRevenue: { type: 'number', example: 1729 },
                    },
                },
                ChurnDataItem: {
                    type: 'object',
                    required: ['month', 'churnRate', 'customers', 'churned'],
                    properties: {
                        month: { type: 'string', example: 'Jan' },
                        churnRate: { type: 'number', example: 7.43 },
                        customers: { type: 'integer', example: 1400 },
                        churned: { type: 'integer', example: 104 },
                    },
                },
                ChartDataItem: {
                    description: 'Shape depends on the parent chart\'s `chartType`.',
                    oneOf: [
                        { $ref: '#/components/schemas/KpiDataItem' },
                        { $ref: '#/components/schemas/BarDataItem' },
                        { $ref: '#/components/schemas/FunnelDataItem' },
                        { $ref: '#/components/schemas/RevenueDataItem' },
                        { $ref: '#/components/schemas/ChurnDataItem' },
                    ],
                },
                // ── Chart shapes ─────────────────────────────────────────────────
                ChartSummary: {
                    type: 'object',
                    description: 'Lightweight chart descriptor without the data payload.',
                    required: ['id', 'title', 'chartType', 'size', 'semantic', 'processLabel'],
                    properties: {
                        id: { type: 'string', example: 'pipeline-startup' },
                        title: { type: 'string', example: 'Startup Pipeline' },
                        chartType: { $ref: '#/components/schemas/ChartType' },
                        size: { $ref: '#/components/schemas/ChartSize' },
                        semantic: { $ref: '#/components/schemas/SemanticMeta' },
                        processLabel: { type: 'string', example: 'Pipeline' },
                        parentId: { type: 'string', example: 'pipeline', nullable: true },
                        segmentLabel: { type: 'string', example: 'Startup', nullable: true },
                    },
                },
                Chart: {
                    allOf: [
                        { $ref: '#/components/schemas/ChartSummary' },
                        {
                            type: 'object',
                            required: ['data'],
                            properties: {
                                data: {
                                    type: 'array',
                                    items: { $ref: '#/components/schemas/ChartDataItem' },
                                },
                            },
                        },
                    ],
                },
                // ── Platform ─────────────────────────────────────────────────────
                PlatformInfo: {
                    type: 'object',
                    required: ['id', 'name', 'description', 'version'],
                    properties: {
                        id: { type: 'string', example: '3danalytics' },
                        name: { type: 'string', example: '3DAnalytics' },
                        description: { type: 'string' },
                        version: { type: 'string', example: '1.0.0' },
                    },
                },
                // ── Response envelopes ────────────────────────────────────────────
                ErrorResponse: {
                    type: 'object',
                    required: ['success', 'error', 'statusCode'],
                    properties: {
                        success: { type: 'boolean', example: false },
                        error: { type: 'string', example: 'Platform "powerbi" not found.' },
                        statusCode: { type: 'integer', example: 404 },
                    },
                },
                PlatformListResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: true },
                        platform: { type: 'string', example: 'all' },
                        data: { type: 'array', items: { $ref: '#/components/schemas/PlatformInfo' } },
                        meta: {
                            type: 'object',
                            properties: { total: { type: 'integer', example: 1 } },
                        },
                    },
                },
                PlatformResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: true },
                        platform: { type: 'string', example: '3danalytics' },
                        data: { $ref: '#/components/schemas/PlatformInfo' },
                    },
                },
                ChartSummaryListResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: true },
                        platform: { type: 'string', example: '3danalytics' },
                        data: { type: 'array', items: { $ref: '#/components/schemas/ChartSummary' } },
                        meta: {
                            type: 'object',
                            properties: {
                                total: { type: 'integer', example: 30 },
                                filters: { type: 'object', additionalProperties: true },
                            },
                        },
                    },
                },
                ChartResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: true },
                        platform: { type: 'string', example: '3danalytics' },
                        data: { $ref: '#/components/schemas/Chart' },
                    },
                },
                ChartListResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: true },
                        platform: { type: 'string', example: '3danalytics' },
                        data: { type: 'array', items: { $ref: '#/components/schemas/Chart' } },
                        meta: {
                            type: 'object',
                            properties: {
                                total: { type: 'integer', example: 5 },
                                parentId: { type: 'string', example: 'dashboard' },
                            },
                        },
                    },
                },
            },
        },
    },
    // Scan these files for @swagger JSDoc annotations
    apis: [
        path_1.default.resolve(__dirname, './routes/*.ts'),
        path_1.default.resolve(__dirname, './routes/*.js'),
    ],
};
exports.swaggerSpec = (0, swagger_jsdoc_1.default)(options);
//# sourceMappingURL=swagger.js.map