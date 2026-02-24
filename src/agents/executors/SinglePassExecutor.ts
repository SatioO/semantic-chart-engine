/**
 * SinglePassExecutor - Backward compatible executor
 * Mimics current system behavior: identify data sources → fetch → visualize
 * No multi-step reasoning or self-correction
 */

import { IExecutor } from './IExecutor';
import { AgentState } from '../AgentState';
import { AgentResponse } from '../../types/agent.types';
import { DataSourceTool } from '../tools/DataSourceTool';
import { VisualizationTool } from '../tools/VisualizationTool';
import { DataValidationTool } from '../tools/DataValidationTool';
import { DataQualityEvaluator } from '../evaluators/DataQualityEvaluator';

export class SinglePassExecutor implements IExecutor {
  name = 'single_pass';
  description =
    'Simple single-pass execution (backward compatible with current system)';

  constructor(
    private dataSourceTool: DataSourceTool,
    private visualizationTool: VisualizationTool,
    private dataValidationTool: DataValidationTool,
    private chartService: any, // ChartService for fetching data
  ) {}

  async execute(state: AgentState): Promise<AgentResponse> {
    const startTime = Date.now();

    try {
      state.status = 'planning';

      if (state.config.verboseLogging) {
        console.log(
          `[SinglePassExecutor] Starting execution for: "${state.query}"`,
        );
      }

      // Step 1: Identify relevant data sources
      state.status = 'executing';
      const dataSourceResult = await this.identifyDataSources(state);

      if (!dataSourceResult.success || !dataSourceResult.data?.dataSources) {
        throw new Error('Failed to identify data sources');
      }

      // Step 2: Fetch chart data
      const charts = await this.fetchChartData(
        state,
        dataSourceResult.data.dataSources,
      );

      // Step 3: Validate data (but don't stop on issues in backward compatible mode)
      await this.validateData(state, charts);

      // Step 4: Generate visualizations
      const visualizationResult = await this.generateVisualizations(
        state,
        charts,
      );

      if (!visualizationResult.success) {
        throw new Error('Failed to generate visualizations');
      }

      state.status = 'complete';
      state.markComplete();

      // Build response
      const response: AgentResponse = {
        finalAnswer:
          visualizationResult.data.narrative ||
          'Analysis complete',
        visualizations: visualizationResult.data.visualizations || [],
        dataSources: dataSourceResult.data.dataSources || [],
        reasoning:
          dataSourceResult.data.reasoning ||
          'Selected relevant data sources and generated visualizations',
        reasoningTrace: state.reasoningTrace,
        executionSteps: state.steps,
        learnings: state.learnings,
        corrections: [],
        iterations: state.currentIteration,
        confidence: state.overallConfidence,
        executionTime: Date.now() - startTime,
        meta: {
          total: visualizationResult.data.visualizations?.length || 0,
          successful: state.getSuccessfulStepsCount(),
          failed: state.getFailedStepsCount(),
          narrative: visualizationResult.data.narrative,
          keyInsights: visualizationResult.data.keyInsights || [],
        },
      };

      return response;
    } catch (error: any) {
      state.status = 'failed';
      state.markFailed();

      if (state.config.verboseLogging) {
        console.error(`[SinglePassExecutor] Error: ${error.message}`);
      }

      throw error;
    }
  }

  private async identifyDataSources(state: AgentState): Promise<any> {
    const step = {
      id: 'identify-data-sources',
      type: 'identify' as const,
      stepNumber: state.steps.length + 1,
      input: { query: state.query },
      output: null,
      evaluation: {
        success: false,
        confidence: 0,
        issues: [],
        corrections: [],
      },
      startedAt: new Date(),
    };

    try {
      // Get platform metadata
      const metadata = await this.chartService.getPlatformMetadata(
        state.platformId,
      );

      const result = await this.dataSourceTool.execute(
        {
          query: state.query,
          metadata,
        },
        {
          state,
          config: state.config,
        },
      );

      step.output = result;
      step.evaluation = {
        success: result.success,
        confidence: result.confidence || 0.8,
        issues: result.issues || [],
        corrections: [],
      };
      step.completedAt = new Date();
      step.durationMs =
        step.completedAt.getTime() - step.startedAt.getTime();

      state.addStep(step);

      // Add reasoning trace
      state.addReasoningStep({
        step: state.steps.length,
        thought: `Need to identify relevant data sources for: "${state.query}"`,
        action: 'Execute DataSourceTool',
        observation: `Found ${result.data?.dataSources?.length || 0} relevant data sources`,
        evaluation: result.success ? 'Data sources identified successfully' : 'Failed to identify data sources',
        timestamp: new Date(),
      });

      return result;
    } catch (error: any) {
      step.output = { error: error.message };
      step.evaluation.issues.push({
        type: 'error',
        severity: 'critical',
        description: error.message,
      });
      step.completedAt = new Date();
      step.durationMs =
        step.completedAt.getTime() - step.startedAt.getTime();

      state.addStep(step);
      throw error;
    }
  }

  private async fetchChartData(
    state: AgentState,
    dataSources: any[],
  ): Promise<any[]> {
    const step = {
      id: 'fetch-chart-data',
      type: 'fetch' as const,
      stepNumber: state.steps.length + 1,
      input: { dataSources },
      output: null,
      evaluation: {
        success: false,
        confidence: 0,
        issues: [],
        corrections: [],
      },
      startedAt: new Date(),
    };

    try {
      const charts = await this.chartService.getCharts(
        state.platformId,
        dataSources.map((ds) => ds.id),
      );

      step.output = { charts, count: charts.length };
      step.evaluation = {
        success: true,
        confidence: 0.9,
        issues: [],
        corrections: [],
      };
      step.completedAt = new Date();
      step.durationMs =
        step.completedAt.getTime() - step.startedAt.getTime();

      state.addStep(step);

      state.addReasoningStep({
        step: state.steps.length,
        thought: `Need to fetch data from ${dataSources.length} data sources`,
        action: 'Fetch chart data from APIs',
        observation: `Retrieved ${charts.length} chart objects`,
        evaluation: 'Data fetched successfully',
        timestamp: new Date(),
      });

      return charts;
    } catch (error: any) {
      step.output = { error: error.message };
      step.evaluation.issues.push({
        type: 'error',
        severity: 'critical',
        description: error.message,
      });
      step.completedAt = new Date();
      step.durationMs =
        step.completedAt.getTime() - step.startedAt.getTime();

      state.addStep(step);
      throw error;
    }
  }

  private async validateData(state: AgentState, charts: any[]): Promise<void> {
    const step = {
      id: 'validate-data',
      type: 'validate' as const,
      stepNumber: state.steps.length + 1,
      input: { charts },
      output: null,
      evaluation: {
        success: false,
        confidence: 0,
        issues: [],
        corrections: [],
      },
      startedAt: new Date(),
    };

    try {
      const result = await this.dataValidationTool.execute(
        {
          data: charts,
          query: state.query,
        },
        {
          state,
          config: state.config,
        },
      );

      step.output = result;
      step.evaluation = {
        success: result.success,
        confidence: result.confidence || 0.7,
        issues: result.data?.issues || [],
        corrections: [],
      };
      step.completedAt = new Date();
      step.durationMs =
        step.completedAt.getTime() - step.startedAt.getTime();

      state.addStep(step);

      // Note issues but don't fail (backward compatible)
      if (result.data?.issues && result.data.issues.length > 0) {
        state.addReasoningStep({
          step: state.steps.length,
          thought: 'Validating data quality',
          action: 'Execute DataValidationTool',
          observation: `Found ${result.data.issues.length} issue(s)`,
          evaluation: 'Noted issues but continuing for backward compatibility',
          timestamp: new Date(),
        });
      }
    } catch (error: any) {
      // Don't fail on validation errors in backward compatible mode
      step.completedAt = new Date();
      step.durationMs =
        step.completedAt.getTime() - step.startedAt.getTime();
      state.addStep(step);
    }
  }

  private async generateVisualizations(
    state: AgentState,
    charts: any[],
  ): Promise<any> {
    const step = {
      id: 'generate-visualizations',
      type: 'synthesize' as const,
      stepNumber: state.steps.length + 1,
      input: { charts },
      output: null,
      evaluation: {
        success: false,
        confidence: 0,
        issues: [],
        corrections: [],
      },
      startedAt: new Date(),
    };

    try {
      const result = await this.visualizationTool.execute(
        {
          query: state.query,
          data: charts,
        },
        {
          state,
          config: state.config,
        },
      );

      step.output = result;
      step.evaluation = {
        success: result.success,
        confidence: result.confidence || 0.85,
        issues: result.issues || [],
        corrections: [],
      };
      step.completedAt = new Date();
      step.durationMs =
        step.completedAt.getTime() - step.startedAt.getTime();

      state.addStep(step);

      state.addReasoningStep({
        step: state.steps.length,
        thought: 'Need to generate visualizations from chart data',
        action: 'Execute VisualizationTool',
        observation: `Generated ${result.data?.visualizations?.length || 0} visualizations`,
        evaluation: 'Visualizations created successfully',
        timestamp: new Date(),
      });

      return result;
    } catch (error: any) {
      step.output = { error: error.message };
      step.evaluation.issues.push({
        type: 'error',
        severity: 'critical',
        description: error.message,
      });
      step.completedAt = new Date();
      step.durationMs =
        step.completedAt.getTime() - step.startedAt.getTime();

      state.addStep(step);
      throw error;
    }
  }
}
