"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPlatformsRouter = createPlatformsRouter;
const express_1 = require("express");
function createPlatformsRouter(chartService) {
    const router = (0, express_1.Router)();
    /**
     * @swagger
     * /api/platforms:
     *   get:
     *     summary: List all registered adapter platforms
     *     description: Returns metadata for every platform adapter currently registered in the engine. Add a new adapter to `AdapterRegistry` and it appears here automatically.
     *     tags: [Platforms]
     *     responses:
     *       200:
     *         description: Array of platform info objects
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/PlatformListResponse'
     *             example:
     *               success: true
     *               platform: all
     *               data:
     *                 - id: 3danalytics
     *                   name: 3DAnalytics
     *                   description: File-based SaaS analytics adapter serving hierarchical chart data.
     *                   version: 1.0.0
     *               meta:
     *                 total: 1
     */
    router.get('/', async (_req, res) => {
        const platforms = await chartService.listPlatforms();
        const response = {
            success: true,
            platform: 'all',
            data: platforms,
            meta: { total: platforms.length },
        };
        res.json(response);
    });
    /**
     * @swagger
     * /api/platforms/{platformId}:
     *   get:
     *     summary: Get a single platform by ID
     *     description: Returns metadata for the requested platform adapter. Use `GET /api/platforms` to discover available platform IDs.
     *     tags: [Platforms]
     *     parameters:
     *       - in: path
     *         name: platformId
     *         required: true
     *         schema:
     *           type: string
     *           example: 3danalytics
     *         description: The platform adapter identifier
     *     responses:
     *       200:
     *         description: Platform info
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/PlatformResponse'
     *       404:
     *         description: Platform not found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *             example:
     *               success: false
     *               error: Platform "powerbi" not found. Available platforms can be listed at GET /api/platforms
     *               statusCode: 404
     */
    router.get('/:platformId', async (req, res) => {
        const { platformId } = req.params;
        const info = await chartService.getPlatformInfo(platformId);
        if (!info) {
            res.status(404).json({
                success: false,
                error: `Platform "${platformId}" not found. Available platforms can be listed at GET /api/platforms`,
                statusCode: 404,
            });
            return;
        }
        const response = {
            success: true,
            platform: platformId,
            data: info,
        };
        res.json(response);
    });
    return router;
}
//# sourceMappingURL=platforms.routes.js.map