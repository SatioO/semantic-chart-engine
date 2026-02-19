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
   *     summary: Query the platform with natural language (AI-Powered Visualization)
   *     description: |
   *       Revolutionary AI-powered analytics endpoint that transforms natural language queries
   *       into intelligent, story-driven dashboard layouts.
   *
   *       **How it works:**
   *       1. AI analyzes your query to identify relevant data sources
   *       2. Fetches all necessary chart data in parallel
   *       3. AI orchestrates an optimal visualization layout with:
   *          - Intelligent sizing and positioning
   *          - Hierarchical drilldown structure
   *          - Data-driven insights and recommendations
   *          - Story-driven narrative
   *
   *       **Example queries:**
   *       - "Show me revenue performance across all segments"
   *       - "How are our startup customers performing in the pipeline?"
   *       - "Compare marketing efficiency between SMB and Enterprise"
   *       - "Where are our enterprise leads coming from?"
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
   *                       description: Original user query
   *                     reasoning:
   *                       type: string
   *                       description: AI explanation of data source selection
   *                     narrative:
   *                       type: string
   *                       description: AI-generated story explaining what the hierarchical data shows
   *                     data:
   *                       type: array
   *                       description: Hierarchical visualization structure with parent-child relationships
   *                       items:
   *                         type: object
   *                         properties:
   *                           id:
   *                             type: string
   *                             description: Unique chart identifier
   *                           title:
   *                             type: string
   *                             description: Display title for the visualization
   *                           chartType:
   *                             type: string
   *                             description: Type of chart (e.g., "bar", "kpi")
   *                           size:
   *                             type: object
   *                             description: Grid-based sizing (12-column layout)
   *                             properties:
   *                               width:
   *                                 type: number
   *                                 description: Column width (1-12)
   *                               height:
   *                                 type: number
   *                                 description: Row height in relative units
   *                           data:
   *                             type: array
   *                             description: Actual chart data with values, labels, and trends
   *                             items:
   *                               type: object
   *                           semantic:
   *                             type: object
   *                             description: Semantic metadata for navigation
   *                             properties:
   *                               processStep:
   *                                 type: integer
   *                                 nullable: true
   *                                 description: Process level (0=Marketing, 1=Leads, 2=Pipeline, 3=Revenue, 4=Retention, null=Dashboard)
   *                               segment:
   *                                 type: integer
   *                                 nullable: true
   *                                 description: Customer segment (null=All, 0=Startup, 1=SMB, 2=Enterprise)
   *                               detailLevel:
   *                                 type: integer
   *                                 description: Hierarchy depth (0=Dashboard, 1=Process, 2=Segment, 3=Detail)
   *                           processLabel:
   *                             type: string
   *                             nullable: true
   *                             description: Human-readable process name
   *                           parentId:
   *                             type: string
   *                             nullable: true
   *                             description: Parent chart ID for drill-down navigation
   *                           segmentLabel:
   *                             type: string
   *                             nullable: true
   *                             description: Human-readable segment name
   *                     keyInsights:
   *                       type: array
   *                       description: Top insights discovered by AI from the data
   *                       items:
   *                         type: string
   *                     meta:
   *                       type: object
   *                       properties:
   *                         total:
   *                           type: integer
   *                           description: Total number of charts fetched
   *                         successful:
   *                           type: integer
   *                           description: Number of successfully fetched charts
   *                         failed:
   *                           type: integer
   *                           description: Number of failed chart fetches
   *                         visualizationsGenerated:
   *                           type: integer
   *                           description: Number of visualizations in hierarchy
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

      // Log successful and failed chart IDs for debugging
      const failedCharts = chartsWithData.filter((c) => !c.success);
      console.log(
        `[UserQuery] Successfully fetched ${successfulCharts.length}/${dataSourceSelection.relevantMetadata.length} charts`,
      );
      if (failedCharts.length > 0) {
        console.log(
          '[UserQuery] Failed to fetch charts:',
          failedCharts.map((c) => c.id),
        );
      }

      // 4. Use AI to orchestrate an intelligent visualization layout
      console.log('[UserQuery] Orchestrating visualization layout with AI...');
      const orchestration = await langChainService.orchestrateVisualization(
        query,
        successfulCharts,
      );

      console.log(
        `[UserQuery] Generated ${orchestration.data.length} visualizations with ${orchestration.meta.keyInsights?.length || 0} insights`,
      );
      console.log(
        '[UserQuery] Orchestration data:',
        JSON.stringify(orchestration.data, null, 2),
      );

      // 5. Return the intelligent visualization structure
      res.json({
        success: true,
        platform: platformId,
        data: {
          query,
          reasoning: dataSourceSelection.reasoning,
          narrative: orchestration.meta.narrative,
          data: orchestration.data,
          keyInsights: orchestration.meta.keyInsights || [],
          meta: {
            total: chartsWithData.length,
            successful: successfulCharts.length,
            failed: chartsWithData.length - successfulCharts.length,
            visualizationsGenerated: orchestration.data.length,
            selectedIds: chartsWithData.map((c) => c.id),
            failedIds: failedCharts.map((c) => c.id),
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
