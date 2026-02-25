/**
 * ReActExecutor - Uses LangChain's ReAct (Reasoning + Acting) pattern
 *
 * ReAct Loop:
 * 1. THOUGHT: Agent reasons about what action to take
 * 2. ACTION: Agent executes a tool
 * 3. OBSERVATION: Agent observes the result
 * 4. Repeat until task complete or max iterations
 *
 * Benefits:
 * - Transparent reasoning process
 * - Self-correction when errors occur
 * - Better decision making
 * - Handles complex multi-step queries
 */

import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createReactAgent } from 'langchain/agents';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { z } from 'zod';
import { IExecutor } from './IExecutor';
import { AgentState } from '../AgentState';
import { AgentResponse } from '../../types/agent.types';
import { ILangChainService } from '../../services/LangChainService';

export class ReActExecutor implements IExecutor {
  name = 'react';
  description = 'ReAct (Reasoning + Acting) executor with transparent thinking and self-correction';

  private llm: ChatOpenAI;
  private agentExecutor: AgentExecutor | null = null;

  constructor(
    private langChain: ILangChainService,
    private chartService: any,
  ) {
    this.llm = new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      temperature: 0.1,
      model: 'gpt-4o-mini',
      verbose: false,
    });
  }

  async execute(state: AgentState): Promise<AgentResponse> {
    const startTime = Date.now();

    try {
      if (state.config.verboseLogging) {
        console.log(`\n[ReActExecutor] Starting ReAct loop for: "${state.query}"`);
      }

      // Create tools for this execution
      const tools = this.createTools(state);

      // Create ReAct agent
      const agent = await this.createAgent(tools);

      // Execute ReAct loop
      const result = await agent.invoke({
        input: state.query,
        platformId: state.platformId,
      });

      if (state.config.verboseLogging) {
        console.log(`[ReActExecutor] Completed ${result.intermediateSteps?.length || 0} reasoning steps`);
      }

      // Process results
      const response = await this.buildResponse(state, result, startTime);

      state.markComplete();
      return response;

    } catch (error: any) {
      state.markFailed();

      if (state.config.verboseLogging) {
        console.error(`[ReActExecutor] Error: ${error.message}`);
      }

      throw error;
    }
  }

  /**
   * Create LangChain tools from our capabilities
   */
  private createTools(state: AgentState): DynamicStructuredTool[] {
    return [
      // Tool 1: Identify Data Sources
      new DynamicStructuredTool({
        name: 'identify_data_sources',
        description:
          'Finds relevant data sources (APIs) for the query. Use this FIRST to discover which datasets contain the needed information. ' +
          'Returns: List of data source IDs and reasoning for selection.',
        schema: z.object({
          query: z.string().describe('User query to analyze'),
        }),
        func: async ({ query }) => {
          const metadata = await this.chartService.getPlatformMetadata(state.platformId);
          const result = await this.langChain.identifyDataSources(query, metadata);

          state.addReasoningStep({
            step: state.steps.length + 1,
            thought: 'Need to identify relevant data sources',
            action: 'identify_data_sources',
            observation: `Found ${result.relevantMetadata.length} data sources`,
            evaluation: result.relevantMetadata.length > 0 ? 'Success' : 'No sources found',
            timestamp: new Date(),
          });

          return JSON.stringify({
            success: true,
            count: result.relevantMetadata.length,
            dataSourceIds: result.relevantMetadata.map((m: any) => m.id),
            reasoning: result.reasoning,
          });
        },
      }),

      // Tool 2: Fetch Data
      new DynamicStructuredTool({
        name: 'fetch_data',
        description:
          'Fetches actual data from specified data sources. Use this AFTER identifying sources. ' +
          'Returns: Summary of fetched charts including data size and availability.',
        schema: z.object({
          dataSourceIds: z.array(z.string()).describe('Data source IDs to fetch (from identify_data_sources)'),
        }),
        func: async ({ dataSourceIds }) => {
          const charts = await this.chartService.getCharts(state.platformId, dataSourceIds);

          const summary = charts.map((c: any) => ({
            id: c.id,
            hasData: c.chartData?.data && c.chartData.data.length > 0,
            dataSize: c.chartData?.data?.length || 0,
            chartType: c.chartData?.chartType,
          }));

          state.addReasoningStep({
            step: state.steps.length + 1,
            thought: `Fetching data from ${dataSourceIds.length} sources`,
            action: 'fetch_data',
            observation: `Retrieved ${charts.length} charts`,
            evaluation: charts.length > 0 ? 'Data fetched' : 'No data retrieved',
            timestamp: new Date(),
          });

          return JSON.stringify({
            success: true,
            chartsCount: charts.length,
            summary,
            charts: charts, // Include full data for next steps
          });
        },
      }),

      // Tool 3: Validate Data Quality
      new DynamicStructuredTool({
        name: 'validate_data',
        description:
          'Checks data quality for issues like empty data, missing fields, invalid structure. ' +
          'Use this AFTER fetching data and BEFORE generating visualizations. ' +
          'Returns: Validation results with any issues found.',
        schema: z.object({
          dataSourceIds: z.array(z.string()).describe('Data source IDs to validate'),
        }),
        func: async ({ dataSourceIds }) => {
          const charts = await this.chartService.getCharts(state.platformId, dataSourceIds);

          const issues: any[] = [];
          let validCount = 0;

          for (const chart of charts) {
            const data = chart.chartData?.data;

            if (!data || (Array.isArray(data) && data.length === 0)) {
              issues.push({
                chartId: chart.id,
                type: 'zero_rows',
                severity: 'critical',
                message: `${chart.id} has no data - may need different data source or filters`,
              });
            } else {
              validCount++;
            }
          }

          state.addReasoningStep({
            step: state.steps.length + 1,
            thought: 'Validating data quality',
            action: 'validate_data',
            observation: `${validCount}/${charts.length} charts have valid data, ${issues.length} issues found`,
            evaluation: issues.length === 0 ? 'All data valid' : `${issues.length} issues detected`,
            timestamp: new Date(),
          });

          return JSON.stringify({
            success: true,
            totalCharts: charts.length,
            validCharts: validCount,
            issuesFound: issues.length,
            issues,
            recommendation: issues.length > 0
              ? 'Consider using different data sources or adjusting query'
              : 'Data quality good, proceed with visualization',
          });
        },
      }),

      // Tool 4: Calculate Aggregations
      new DynamicStructuredTool({
        name: 'calculate_aggregations',
        description:
          'Calculates aggregate metrics (sum, average, count, min, max) across multiple data sources. ' +
          'Use this when creating summary/overview panels that need totals. ' +
          'Returns: Calculated aggregated value.',
        schema: z.object({
          dataSourceIds: z.array(z.string()).describe('Data sources to aggregate'),
          operation: z.enum(['sum', 'average', 'count', 'min', 'max']).describe('Aggregation operation'),
          field: z.string().describe('Field to aggregate (e.g., "revenue", "count", "value")'),
        }),
        func: async ({ dataSourceIds, operation, field }) => {
          const charts = await this.chartService.getCharts(state.platformId, dataSourceIds);

          const values: number[] = [];
          for (const chart of charts) {
            const data = chart.chartData?.data || [];
            for (const item of data) {
              if (item[field] !== undefined && typeof item[field] === 'number') {
                values.push(item[field]);
              }
            }
          }

          let result: number = 0;
          switch (operation) {
            case 'sum':
              result = values.reduce((a, b) => a + b, 0);
              break;
            case 'average':
              result = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
              break;
            case 'count':
              result = values.length;
              break;
            case 'min':
              result = values.length > 0 ? Math.min(...values) : 0;
              break;
            case 'max':
              result = values.length > 0 ? Math.max(...values) : 0;
              break;
          }

          state.addReasoningStep({
            step: state.steps.length + 1,
            thought: `Calculating ${operation} of ${field}`,
            action: 'calculate_aggregations',
            observation: `Result: ${result} (processed ${values.length} values)`,
            evaluation: 'Aggregation calculated',
            timestamp: new Date(),
          });

          return JSON.stringify({
            success: true,
            operation,
            field,
            result,
            valuesProcessed: values.length,
          });
        },
      }),

      // Tool 5: Generate Visualizations
      new DynamicStructuredTool({
        name: 'generate_visualizations',
        description:
          'Generates final chart visualizations from validated data. ' +
          'Use this as the FINAL step after data is validated. ' +
          'IMPORTANT: Only use this when data quality is good. ' +
          'Returns: Complete visualization structure with charts, narrative, and insights.',
        schema: z.object({
          query: z.string().describe('Original user query'),
          dataSourceIds: z.array(z.string()).describe('Data source IDs with valid data'),
        }),
        func: async ({ query, dataSourceIds }) => {
          const charts = await this.chartService.getCharts(state.platformId, dataSourceIds);
          const result = await this.langChain.orchestrateVisualization(query, charts);

          state.addReasoningStep({
            step: state.steps.length + 1,
            thought: 'Generating final visualizations',
            action: 'generate_visualizations',
            observation: `Created ${result.data.length} visualizations`,
            evaluation: 'Visualizations generated successfully',
            timestamp: new Date(),
          });

          return JSON.stringify({
            success: true,
            visualizations: result.data,
            narrative: result.meta.narrative,
            keyInsights: result.meta.keyInsights,
            meta: result.meta,
          });
        },
      }),
    ];
  }

  /**
   * Create ReAct agent with domain-specific prompt
   */
  private async createAgent(tools: DynamicStructuredTool[]): Promise<AgentExecutor> {
    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        `You are a data visualization agent that creates charts for user queries.

WORKFLOW (follow this order):
1. FIRST: Use identify_data_sources to find relevant APIs
2. THEN: Use fetch_data to get the actual data
3. THEN: Use validate_data to check data quality
4. IF issues found: Consider alternative data sources or inform user
5. IF creating summaries: Use calculate_aggregations for totals
6. FINALLY: Use generate_visualizations to create charts

CRITICAL RULES:
- NEVER hallucinate or invent data
- ALWAYS validate data before visualizing
- If data is empty, diagnose why (wrong source, filters, etc.)
- Use exact values from source data
- Calculate aggregations for summary panels (never return empty data)

Available tools: {tools}

Tool names: {tool_names}

Use this format:
Thought: [Your reasoning about what to do next]
Action: [Tool name]
Action Input: [Tool parameters as JSON]
Observation: [Tool result]
... (repeat Thought/Action/Observation as needed)
Thought: I now have everything needed to answer
Final Answer: [JSON output from generate_visualizations]

Query: {input}
Platform: {platformId}

{agent_scratchpad}`,
      ],
    ]);

    const agent = await createReactAgent({
      llm: this.llm,
      tools,
      prompt,
    });

    return new AgentExecutor({
      agent,
      tools,
      maxIterations: 10,
      verbose: true,
      returnIntermediateSteps: true,
      handleParsingErrors: true,
    });
  }

  /**
   * Build AgentResponse from ReAct execution results
   */
  private async buildResponse(
    state: AgentState,
    result: any,
    startTime: number,
  ): Promise<AgentResponse> {
    // Parse final answer
    let visualizations: any[] = [];
    let narrative = '';
    let keyInsights: string[] = [];

    try {
      const parsed = JSON.parse(result.output);
      visualizations = parsed.visualizations || [];
      narrative = parsed.narrative || '';
      keyInsights = parsed.keyInsights || [];
    } catch {
      // If not JSON, treat as narrative
      narrative = result.output;
    }

    return {
      finalAnswer: narrative || 'Analysis complete',
      visualizations,
      dataSources: [],
      reasoning: `ReAct process completed in ${result.intermediateSteps?.length || 0} steps`,
      reasoningTrace: state.reasoningTrace,
      executionSteps: state.steps,
      learnings: state.learnings,
      corrections: [],
      iterations: result.intermediateSteps?.length || 0,
      confidence: state.overallConfidence,
      executionTime: Date.now() - startTime,
      meta: {
        total: visualizations.length,
        successful: visualizations.length,
        failed: 0,
        narrative,
        keyInsights,
      },
    };
  }
}
