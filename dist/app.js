"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const AdapterRegistry_1 = require("./adapters/AdapterRegistry");
const ChartService_1 = require("./services/ChartService");
const platforms_routes_1 = require("./routes/platforms.routes");
const charts_routes_1 = require("./routes/charts.routes");
const swagger_1 = require("./swagger");
const app = (0, express_1.default)();
const PORT = process.env.PORT ?? 3000;
// ── Middleware ──────────────────────────────────────────────────────────────
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// ── Dependency wiring ───────────────────────────────────────────────────────
const chartService = new ChartService_1.ChartService(AdapterRegistry_1.registry);
// ── Swagger UI ──────────────────────────────────────────────────────────────
app.use('/api/docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swagger_1.swaggerSpec, {
    customSiteTitle: 'Semantic Chart Engine – API Docs',
    swaggerOptions: {
        persistAuthorization: true,
        tryItOutEnabled: true,
    },
}));
/** Expose the raw OpenAPI JSON spec so tooling can consume it */
app.get('/api/docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swagger_1.swaggerSpec);
});
// ── Routes ──────────────────────────────────────────────────────────────────
/**
 * @swagger
 * /:
 *   get:
 *     summary: Engine health check and discovery
 *     description: Returns the engine version, all available endpoints, semantic filter reference, and registered platforms.
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Engine info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
app.get('/', (_req, res) => {
    res.json({
        name: 'Semantic Chart Engine',
        version: '1.0.0',
        description: 'Generic charting engine with pluggable platform adapters',
        docs: `GET /api/docs`,
        endpoints: {
            platforms: 'GET /api/platforms',
            platformById: 'GET /api/platforms/:platformId',
            platformMetadata: 'GET /api/platforms/:platformId/metadata',
            charts: 'GET /api/platforms/:platformId/charts',
            chartsFiltered: 'GET /api/platforms/:platformId/charts?detailLevel=<0-3>&processStep=<0-4>&segment=<0-2|-1>&parentId=<id>&chartType=<type>',
            chartById: 'GET /api/platforms/:platformId/charts/:chartId',
            chartChildren: 'GET /api/platforms/:platformId/charts/:chartId/children',
        },
        semanticFilters: {
            detailLevel: { 0: 'Overview', 1: 'Process', 2: 'Segment', 3: 'Detail' },
            processStep: {
                0: 'Marketing',
                1: 'Leads',
                2: 'Pipeline',
                3: 'Revenue',
                4: 'Retention',
            },
            segment: {
                '-1': 'None (all segments)',
                0: 'Startup',
                1: 'SMB',
                2: 'Enterprise',
            },
            chartType: ['kpi', 'bar', 'funnel', 'revenue', 'churn'],
        },
        registeredPlatforms: AdapterRegistry_1.registry.listPlatformIds(),
    });
});
app.use('/api/platforms', (0, platforms_routes_1.createPlatformsRouter)(chartService));
app.use('/api/platforms/:platformId/charts', (0, charts_routes_1.createChartsRouter)(chartService));
// ── 404 handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found.',
        statusCode: 404,
    });
});
// ── Global error handler ─────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err, _req, res, _next) => {
    console.error('[Error]', err.message);
    res.status(500).json({
        success: false,
        error: 'Internal server error.',
        statusCode: 500,
    });
});
// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\nSemantic Chart Engine running on http://localhost:${PORT}`);
    console.log(`Registered platforms: ${AdapterRegistry_1.registry.listPlatformIds().join(', ')}`);
    console.log(`\nSwagger UI: http://localhost:${PORT}/api/docs`);
    console.log(`OpenAPI spec: http://localhost:${PORT}/api/docs.json`);
    console.log('\nAvailable endpoints:');
    console.log(`  GET http://localhost:${PORT}/`);
    console.log(`  GET http://localhost:${PORT}/api/platforms`);
    console.log(`  GET http://localhost:${PORT}/api/platforms/3danalytics`);
    console.log(`  GET http://localhost:${PORT}/api/platforms/3danalytics/metadata`);
    console.log(`  GET http://localhost:${PORT}/api/platforms/3danalytics/charts`);
    console.log(`  GET http://localhost:${PORT}/api/platforms/3danalytics/charts/dashboard`);
    console.log(`  GET http://localhost:${PORT}/api/platforms/3danalytics/charts/dashboard/children`);
    console.log(`  GET http://localhost:${PORT}/api/platforms/3danalytics/charts?detailLevel=1`);
    console.log(`  GET http://localhost:${PORT}/api/platforms/3danalytics/charts?processStep=2&segment=0`);
    console.log(`  GET http://localhost:${PORT}/api/platforms/3danalytics/charts?chartType=funnel\n`);
});
exports.default = app;
//# sourceMappingURL=app.js.map