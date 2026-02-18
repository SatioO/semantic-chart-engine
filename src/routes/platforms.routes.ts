import { Router, Request, Response } from 'express';
import { ChartService } from '../services/ChartService';
import { ApiResponse, PlatformInfo } from '../types/chart.types';

export function createPlatformsRouter(chartService: ChartService): Router {
  const router = Router();

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
  router.get('/', async (_req: Request, res: Response) => {
    const platforms = await chartService.listPlatforms();
    const response: ApiResponse<PlatformInfo[]> = {
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
  router.get('/:platformId', async (req: Request, res: Response) => {
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

    const response: ApiResponse<PlatformInfo> = {
      success: true,
      platform: platformId,
      data: info,
    };
    res.json(response);
  });

  /**
   * @swagger
   * /api/platforms/{platformId}/metadata:
   *   get:
   *     summary: Get metadata for a single platform by ID
   *     description: Returns additional metadata for the requested platform adapter if available.
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
   *         description: Platform metadata
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               additionalProperties: true
   *       404:
   *         description: Platform not found or no metadata available
   */
  router.get('/:platformId/metadata', async (req: Request, res: Response) => {
    const { platformId } = req.params;
    const metadata = await chartService.getPlatformMetadata(platformId);

    if (!metadata) {
      res.status(404).json({
        success: false,
        error: `Metadata for platform "${platformId}" not found.`,
        statusCode: 404,
      });
      return;
    }

    const response: ApiResponse<any> = {
      success: true,
      platform: platformId,
      data: metadata,
    };
    res.json(response);
  });

  return router;
}
