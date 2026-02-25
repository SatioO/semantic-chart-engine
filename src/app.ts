import 'dotenv/config';
import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';

import { LangChainService } from './services/LangChainService';
import { AgentService } from './services/AgentService';
import { registry } from './adapters/AdapterRegistry';
import { ChartService } from './services/ChartService';
import { createPlatformsRouter } from './routes/platforms.routes';
import { createChartsRouter } from './routes/charts.routes';
import { swaggerSpec } from './swagger';

const app: Application = express();
const PORT = Number(process.env.PORT) || 3000;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Dependency wiring ───────────────────────────────────────────────────────
const chartService = new ChartService(registry);
const langChainService = new LangChainService();
const agentService = new AgentService(langChainService, chartService);

console.log('✅ Services initialized:');
console.log('   - ChartService');
console.log('   - LangChainService');
console.log('   - AgentService (with ReAct executor)');

// ── Swagger UI ──────────────────────────────────────────────────────────────
app.use(
  '/api/docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'Semantic Chart Engine – API Docs',
    swaggerOptions: {
      persistAuthorization: true,
      tryItOutEnabled: true,
    },
  }),
);

/** Expose the raw OpenAPI JSON spec so tooling can consume it */
app.get('/api/docs.json', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
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
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'Semantic Chart Engine',
    version: '1.0.0',
    description: 'Generic charting engine with pluggable platform adapters',
    docs: `GET /api/docs`,
    endpoints: {
      platforms: 'GET /api/platforms',
      platformById: 'GET /api/platforms/:platformId',
      platformMetadata: 'GET /api/platforms/:platformId/metadata',
      platformChat: 'POST /api/platforms/:platformId/userquery',
      charts: 'GET /api/platforms/:platformId/charts',
      chartsFiltered:
        'GET /api/platforms/:platformId/charts?detailLevel=<0-3>&processStep=<0-4>&segment=<0-2|-1>&parentId=<id>&chartType=<type>',
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
      chartType: ['kpi', 'bar', 'stackedbar', 'funnel', 'revenue', 'churn'],
    },
    registeredPlatforms: registry.listPlatformIds(),
  });
});

app.use(
  '/api/platforms',
  createPlatformsRouter(chartService, langChainService, agentService),
);
app.use('/api/platforms/:platformId/charts', createChartsRouter(chartService));

// ── 404 handler ─────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Route not found.',
    statusCode: 404,
  });
});

// ── Global error handler ─────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Error]', err.message);
  res.status(500).json({
    success: false,
    error: 'Internal server error.',
    statusCode: 500,
  });
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\nSemantic Chart Engine running on http://0.0.0.0:${PORT}`);
  console.log(`Local access: http://localhost:${PORT}`);
  console.log(`Registered platforms: ${registry.listPlatformIds().join(', ')}`);
  console.log(`\nSwagger UI: http://localhost:${PORT}/api/docs`);
  console.log(`OpenAPI spec: http://localhost:${PORT}/api/docs.json`);
  console.log('\nAvailable endpoints:');
  console.log(`  GET http://localhost:${PORT}/`);
  console.log(`  GET http://localhost:${PORT}/api/platforms`);
  console.log(`  GET http://localhost:${PORT}/api/platforms/3danalytics`);
  console.log(
    `  GET http://localhost:${PORT}/api/platforms/3danalytics/metadata`,
  );
  console.log(
    `  POST http://localhost:${PORT}/api/platforms/3danalytics/userquery`,
  );
  console.log(
    `  GET http://localhost:${PORT}/api/platforms/3danalytics/charts`,
  );
  console.log(
    `  GET http://localhost:${PORT}/api/platforms/3danalytics/charts/dashboard`,
  );
  console.log(
    `  GET http://localhost:${PORT}/api/platforms/3danalytics/charts/dashboard/children`,
  );
  console.log(
    `  GET http://localhost:${PORT}/api/platforms/3danalytics/charts?detailLevel=1`,
  );
  console.log(
    `  GET http://localhost:${PORT}/api/platforms/3danalytics/charts?processStep=2&segment=0`,
  );
  console.log(
    `  GET http://localhost:${PORT}/api/platforms/3danalytics/charts?chartType=funnel\n`,
  );
});

export default app;
