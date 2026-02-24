/**
 * DataSourceTool - Identifies relevant data sources for a query
 * Wraps LangChainService.identifyDataSources for backward compatibility
 */

import { BaseTool } from './IAgentTool';
import {
  ToolInput,
  ToolOutput,
  ToolContext,
} from '../../types/agent.types';
import { ILangChainService } from '../../services/LangChainService';

export class DataSourceTool extends BaseTool {
  name = 'identify_data_sources';
  description =
    'Identifies the most relevant data sources (APIs/datasets) for a given query by analyzing metadata and query intent';

  constructor(private langChain: ILangChainService) {
    super();
  }

  async execute(input: ToolInput, context: ToolContext): Promise<ToolOutput> {
    try {
      this.logVerbose(`Identifying data sources for: "${input.query}"`, context);

      if (!input.query) {
        return this.createErrorOutput('Query is required');
      }

      if (!input.metadata || !Array.isArray(input.metadata)) {
        return this.createErrorOutput('Metadata array is required');
      }

      // Use existing LangChain service
      const result = await this.langChain.identifyDataSources(
        input.query,
        input.metadata,
      );

      this.logVerbose(
        `Identified ${result.relevantMetadata.length} relevant data sources`,
        context,
      );

      // Calculate confidence based on reasoning presence and count
      const confidence = this.calculateConfidence(result);

      return this.createSuccessOutput(
        {
          dataSources: result.relevantMetadata,
          reasoning: result.reasoning,
          count: result.relevantMetadata.length,
        },
        confidence,
      );
    } catch (error: any) {
      this.logVerbose(`Error: ${error.message}`, context);
      return this.createErrorOutput(error.message);
    }
  }

  private calculateConfidence(result: any): number {
    // High confidence if we have reasoning and found sources
    if (result.reasoning && result.relevantMetadata.length > 0) {
      return 0.9;
    }

    // Medium confidence if we found sources but no reasoning
    if (result.relevantMetadata.length > 0) {
      return 0.7;
    }

    // Low confidence if no sources found
    return 0.3;
  }

  protected getInputSchema(): any {
    return {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'User query to analyze',
        },
        metadata: {
          type: 'array',
          description: 'Array of available data source metadata',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              api: { type: 'string' },
              category: { type: 'string' },
              intent: { type: 'string' },
            },
          },
        },
      },
      required: ['query', 'metadata'],
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
            dataSources: {
              type: 'array',
              description: 'Identified relevant data sources',
            },
            reasoning: {
              type: 'string',
              description: 'Explanation of why these sources were selected',
            },
            count: {
              type: 'number',
              description: 'Number of data sources identified',
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
          query: 'Show me revenue for startups',
          metadata: [
            { id: 'revenue-startup', api: '/api/revenue-startup' },
            { id: 'marketing-startup', api: '/api/marketing-startup' },
          ],
        },
        output: {
          success: true,
          data: {
            dataSources: [
              { id: 'revenue-startup', api: '/api/revenue-startup' },
            ],
            reasoning:
              'Selected revenue-startup as it directly matches the query',
            count: 1,
          },
          confidence: 0.9,
        },
      },
    ];
  }
}
