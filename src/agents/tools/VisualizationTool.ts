/**
 * VisualizationTool - Orchestrates visualization generation from data
 * Wraps LangChainService.orchestrateVisualization for backward compatibility
 */

import { BaseTool } from './IAgentTool';
import {
  ToolInput,
  ToolOutput,
  ToolContext,
} from '../../types/agent.types';
import { ILangChainService } from '../../services/LangChainService';

export class VisualizationTool extends BaseTool {
  name = 'generate_visualizations';
  description =
    'Generates interactive chart visualizations from data by understanding query intent and creating appropriate chart types';

  constructor(private langChain: ILangChainService) {
    super();
  }

  async execute(input: ToolInput, context: ToolContext): Promise<ToolOutput> {
    try {
      this.logVerbose(
        `Generating visualizations for: "${input.query}"`,
        context,
      );

      if (!input.query) {
        return this.createErrorOutput('Query is required');
      }

      if (!input.data || !Array.isArray(input.data)) {
        return this.createErrorOutput('Data array is required');
      }

      // Use existing LangChain service
      const result = await this.langChain.orchestrateVisualization(
        input.query,
        input.data,
      );

      this.logVerbose(
        `Generated ${result.data.length} visualizations`,
        context,
      );

      // Calculate confidence based on result quality
      const confidence = this.calculateConfidence(result);

      return this.createSuccessOutput(
        {
          visualizations: result.data,
          narrative: result.meta.narrative,
          keyInsights: result.meta.keyInsights,
          total: result.meta.total,
        },
        confidence,
      );
    } catch (error: any) {
      this.logVerbose(`Error: ${error.message}`, context);
      return this.createErrorOutput(error.message);
    }
  }

  private calculateConfidence(result: any): number {
    // High confidence if we have visualizations with narrative
    if (result.data.length > 0 && result.meta.narrative) {
      return 0.95;
    }

    // Good confidence if we have visualizations
    if (result.data.length > 0) {
      return 0.85;
    }

    // Medium confidence if we have meta but no visualizations
    if (result.meta.narrative || result.meta.keyInsights) {
      return 0.6;
    }

    // Low confidence if nothing generated
    return 0.3;
  }

  protected getInputSchema(): any {
    return {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'User query describing what to visualize',
        },
        data: {
          type: 'array',
          description: 'Chart data objects to transform into visualizations',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              chartData: { type: 'object' },
            },
          },
        },
      },
      required: ['query', 'data'],
    };
  }

  protected getOutputSchema(): any {
    return {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            visualizations: {
              type: 'array',
              description: 'Generated chart visualizations',
            },
            narrative: {
              type: 'string',
              description: 'Story explaining the data',
            },
            keyInsights: {
              type: 'array',
              description: 'Key insights from the data',
              items: { type: 'string' },
            },
            total: {
              type: 'number',
              description: 'Total number of visualizations',
            },
          },
        },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
      },
    };
  }

  protected getExamples(): Array<{ input: any; output: any }> {
    return [
      {
        input: {
          query: 'Show revenue trends for startups',
          data: [
            {
              id: 'revenue-startup',
              chartData: { chartType: 'revenue', data: [] },
            },
          ],
        },
        output: {
          success: true,
          data: {
            visualizations: [
              {
                id: 'revenue-overview',
                chartType: 'kpi',
                title: 'Revenue Overview',
              },
            ],
            narrative: 'Revenue shows strong growth...',
            keyInsights: ['Total revenue increased by 15%'],
            total: 1,
          },
          confidence: 0.95,
        },
      },
    ];
  }
}
