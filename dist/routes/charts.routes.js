"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createChartsRouter = createChartsRouter;
const express_1 = require("express");
/**
 * Safely parse a query param as an integer.
 * Returns undefined if the param is missing or not a valid integer.
 */
function parseIntParam(value) {
    if (value === undefined || value === null || value === '')
        return undefined;
    const n = Number(value);
    return Number.isInteger(n) ? n : undefined;
}
function createChartsRouter(chartService) {
    const router = (0, express_1.Router)({ mergeParams: true });
    /**
     * @swagger
     * /api/platforms/{platformId}/charts:
     *   get:
     *     summary: List charts for a platform
     *     description: |
     *       Returns lightweight chart summaries (no data payload) for the given platform.
     *       All query parameters are optional and can be combined freely.
     *
     *       **Semantic filter reference**
     *       | param | values | meaning |
     *       |---|---|---|
     *       | `detailLevel` | 0–3 | 0 = Overview, 1 = Process, 2 = Segment, 3 = Detail |
     *       | `processStep` | 0–4 | 0 = Marketing, 1 = Leads, 2 = Pipeline, 3 = Revenue, 4 = Retention |
     *       | `segment` | −1–2 | −1 = no segment (cross-segment), 0 = Startup, 1 = SMB, 2 = Enterprise |
     *       | `parentId` | chart id | direct children of that chart |
     *       | `chartType` | kpi / bar / funnel / revenue / churn | filter by visual type |
     *     tags: [Charts]
     *     parameters:
     *       - in: path
     *         name: platformId
     *         required: true
     *         schema:
     *           type: string
     *           example: 3danalytics
     *       - in: query
     *         name: detailLevel
     *         schema:
     *           type: integer
     *           minimum: 0
     *           maximum: 3
     *           example: 1
     *         description: "Filter by drill-down depth: 0=Overview, 1=Process, 2=Segment, 3=Detail"
     *       - in: query
     *         name: processStep
     *         schema:
     *           type: integer
     *           minimum: 0
     *           maximum: 4
     *           example: 2
     *         description: "Filter by funnel stage: 0=Marketing, 1=Leads, 2=Pipeline, 3=Revenue, 4=Retention"
     *       - in: query
     *         name: segment
     *         schema:
     *           type: integer
     *           minimum: -1
     *           maximum: 2
     *           example: 0
     *         description: "Filter by customer segment: -1=none (cross-segment overview), 0=Startup, 1=SMB, 2=Enterprise"
     *       - in: query
     *         name: parentId
     *         schema:
     *           type: string
     *           example: dashboard
     *         description: Return only the direct children of this chart ID
     *       - in: query
     *         name: chartType
     *         schema:
     *           $ref: '#/components/schemas/ChartType'
     *         description: Filter by chart visual type
     *     responses:
     *       200:
     *         description: List of chart summaries
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ChartSummaryListResponse'
     *       404:
     *         description: Platform not found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    router.get('/', async (req, res) => {
        const { platformId } = req.params;
        const { detailLevel, processStep, segment, parentId, chartType } = req.query;
        const filters = {};
        const dl = parseIntParam(detailLevel);
        if (dl !== undefined)
            filters.detailLevel = dl;
        const ps = parseIntParam(processStep);
        if (ps !== undefined)
            filters.processStep = ps;
        const seg = parseIntParam(segment);
        if (seg !== undefined)
            filters.segment = seg;
        if (typeof parentId === 'string' && parentId.trim()) {
            filters.parentId = parentId.trim();
        }
        if (typeof chartType === 'string' && chartType.trim()) {
            filters.chartType = chartType.trim();
        }
        const hasFilters = Object.keys(filters).length > 0;
        const summaries = await chartService.listCharts(platformId, hasFilters ? filters : undefined);
        if (summaries === null) {
            res.status(404).json({
                success: false,
                error: `Platform "${platformId}" not found.`,
                statusCode: 404,
            });
            return;
        }
        const response = {
            success: true,
            platform: platformId,
            data: summaries,
            meta: {
                total: summaries.length,
                ...(hasFilters ? { filters } : {}),
            },
        };
        res.json(response);
    });
    /**
     * @swagger
     * /api/platforms/{platformId}/charts/{chartId}:
     *   get:
     *     summary: Get a single chart with full data payload
     *     description: |
     *       Returns the complete chart object including its `data` array.
     *       The shape of each item in `data` depends on `chartType`:
     *       - **kpi** → `KpiDataItem` (label, value, unit, trend, trendDirection)
     *       - **bar** → `BarDataItem` (product, revenue, growth)
     *       - **funnel** → `FunnelDataItem` (stage, count, conversionRate)
     *       - **revenue** → `RevenueDataItem` (month, mrr, arr, newRevenue, churnedRevenue)
     *       - **churn** → `ChurnDataItem` (month, churnRate, customers, churned)
     *     tags: [Charts]
     *     parameters:
     *       - in: path
     *         name: platformId
     *         required: true
     *         schema:
     *           type: string
     *           example: 3danalytics
     *       - in: path
     *         name: chartId
     *         required: true
     *         schema:
     *           type: string
     *           example: dashboard
     *         description: Chart identifier
     *     responses:
     *       200:
     *         description: Full chart with data payload
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ChartResponse'
     *       404:
     *         description: Platform or chart not found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    router.get('/:chartId', async (req, res) => {
        const { platformId, chartId } = req.params;
        const chart = await chartService.getChart(platformId, chartId);
        if (chart === null) {
            const platform = await chartService.getPlatformInfo(platformId);
            if (!platform) {
                res.status(404).json({
                    success: false,
                    error: `Platform "${platformId}" not found.`,
                    statusCode: 404,
                });
                return;
            }
            res.status(404).json({
                success: false,
                error: `Chart "${chartId}" not found on platform "${platformId}".`,
                statusCode: 404,
            });
            return;
        }
        const response = {
            success: true,
            platform: platformId,
            data: chart,
        };
        res.json(response);
    });
    /**
     * @swagger
     * /api/platforms/{platformId}/charts/{chartId}/children:
     *   get:
     *     summary: Get direct children of a chart
     *     description: |
     *       Returns the immediate children of `chartId` in the hierarchy with full data payloads.
     *       Use this for drill-down navigation:
     *       1. `dashboard` (detailLevel 0) → 5 process charts (detailLevel 1)
     *       2. A process chart → 3 segment charts per segment (detailLevel 2)
     *       3. A segment chart → detailed breakdown charts (detailLevel 3)
     *     tags: [Charts]
     *     parameters:
     *       - in: path
     *         name: platformId
     *         required: true
     *         schema:
     *           type: string
     *           example: 3danalytics
     *       - in: path
     *         name: chartId
     *         required: true
     *         schema:
     *           type: string
     *           example: dashboard
     *         description: The parent chart whose children to retrieve
     *     responses:
     *       200:
     *         description: Array of child charts with data payloads
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ChartListResponse'
     *             example:
     *               success: true
     *               platform: 3danalytics
     *               data: []
     *               meta:
     *                 total: 5
     *                 parentId: dashboard
     *       404:
     *         description: Platform not found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    router.get('/:chartId/children', async (req, res) => {
        const { platformId, chartId } = req.params;
        const children = await chartService.getChildren(platformId, chartId);
        if (children === null) {
            res.status(404).json({
                success: false,
                error: `Platform "${platformId}" not found.`,
                statusCode: 404,
            });
            return;
        }
        const response = {
            success: true,
            platform: platformId,
            data: children,
            meta: { total: children.length, parentId: chartId },
        };
        res.json(response);
    });
    return router;
}
//# sourceMappingURL=charts.routes.js.map