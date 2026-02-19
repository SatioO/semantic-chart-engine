import { Router, Request, Response } from 'express';
import { ChartService } from '../services/ChartService';
import { ILangChainService } from '../services/LangChainService';
import { ApiResponse, PlatformInfo } from '../types/chart.types';

export function createPlatformsRouter(
  chartService: ChartService,
  langChainService: ILangChainService,
): Router {
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

  /**
   * @swagger
   * /api/platforms/{platformId}/userquery:
   *   post:
   *     summary: Query the platform with natural language
   *     description: |
   *       Analyzes a natural language query using AI to identify relevant data sources,
   *       then fetches the complete chart data for all identified sources.
   *
   *       The AI considers business context (marketing, leads, pipeline, revenue, retention),
   *       customer segments (startup, SMB, enterprise), and detail level to select
   *       the most relevant charts.
   *     tags: [Platforms]
   *     parameters:
   *       - in: path
   *         name: platformId
   *         required: true
   *         schema:
   *           type: string
   *           example: 3danalytics
   *         description: The platform adapter identifier
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - query
   *             properties:
   *               query:
   *                 type: string
   *                 example: "Show me marketing performance for startups"
   *                 description: Natural language query describing the data you want to see
   *     responses:
   *       200:
   *         description: Successfully identified and fetched relevant charts
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 platform:
   *                   type: string
   *                 data:
   *                   type: object
   *                   properties:
   *                     query:
   *                       type: string
   *                     reasoning:
   *                       type: string
   *                       description: AI explanation of why these charts were selected
   *                     charts:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           id:
   *                             type: string
   *                           api:
   *                             type: string
   *                           chart:
   *                             type: object
   *                             description: Full chart object with data payload
   *                           success:
   *                             type: boolean
   *                     meta:
   *                       type: object
   *                       properties:
   *                         total:
   *                           type: integer
   *                         successful:
   *                           type: integer
   *                         failed:
   *                           type: integer
   *       400:
   *         description: Missing or invalid query parameter
   *       404:
   *         description: Platform not found or no metadata available
   *       500:
   *         description: Internal server error
   */
  router.post('/:platformId/userquery', async (req: Request, res: Response) => {
    const { platformId } = req.params;
    const { query } = req.body;

    if (!query) {
      res.status(400).json({
        success: false,
        error: 'Query is required',
        statusCode: 400,
      });
      return;
    }

    try {
      // 1. Retrieve metadata from the adapter
      const metadata = await chartService.getPlatformMetadata(platformId);

      if (!metadata) {
        res.status(404).json({
          success: false,
          error: `Metadata for platform "${platformId}" not found.`,
          statusCode: 404,
        });
        return;
      }

      console.log(
        `[UserQuery] Metadata for ${platformId}:`,
        JSON.stringify(metadata, null, 2),
      );

      // 2. Use LangChain service to identify relevant data sources
      const dataSourceSelection = await langChainService.identifyDataSources(query, metadata);

      console.log(
        `[UserQuery] AI identified ${dataSourceSelection.relevantMetadata.length} relevant data sources:`,
        dataSourceSelection.relevantMetadata.map((m: any) => m.id),
      );

      // 3. Fetch actual chart data for all identified data sources in parallel
      // Using Promise.allSettled to handle individual failures gracefully
      const chartPromises = dataSourceSelection.relevantMetadata.map(
        (dataSource: any) =>
          chartService
            .getChart(platformId, dataSource.id)
            .then((chart) => ({
              ...dataSource,
              chart,
              success: chart !== null,
            }))
            .catch((error: any) => {
              console.error(
                `[UserQuery] Error fetching chart ${dataSource.id}:`,
                error.message,
              );
              return {
                ...dataSource,
                chart: null,
                success: false,
                error: error.message,
              };
            }),
      );

      const chartsWithData = await Promise.all(chartPromises);

      // Filter out any failed fetches (optional - you can keep them to show errors)
      const successfulCharts = chartsWithData.filter((c) => c.success);

      console.log(
        `[UserQuery] Successfully fetched ${successfulCharts.length}/${dataSourceSelection.relevantMetadata.length} charts`,
      );

      // 4. Return the selected data sources with their chart data
      res.json({
        success: true,
        platform: platformId,
        data: {
          query,
          reasoning: dataSourceSelection.reasoning,
          charts: chartsWithData,
          meta: {
            total: chartsWithData.length,
            successful: successfulCharts.length,
            failed: chartsWithData.length - successfulCharts.length,
          },
        },
      });
    } catch (error: any) {
      console.error('[UserQuery] Error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error',
        statusCode: 500,
      });
    }
  });

  return router;
}
