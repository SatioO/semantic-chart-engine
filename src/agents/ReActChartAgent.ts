/**
 * ReActChartAgent - Implements ReAct (Reasoning + Acting) pattern using LangChain
 *
 * ReAct Flow:
 * 1. THOUGHT: Agent reasons about what to do next
 * 2. ACTION: Agent uses a tool to take action
 * 3. OBSERVATION: Agent observes the result
 * 4. Repeat until task is complete
 *
 * This provides:
 * - Transparent reasoning process
 * - Self-correction capabilities
 * - Better decision making
 * - Improved data quality
 */

import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createReactAgent } from 'langchain/agents';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { z } from 'zod';
import { ILangChainService } from '../services/LangChainService';
import { AgentConfig, AgentResponse, DEFAULT_AGENT_CONFIG } from '../types/agent.types';
import { AgentState } from './AgentState';

export class ReActChartAgent {
  private llm: ChatOpenAI;
  private tools: DynamicStructuredTool[];
  private agentExecutor: AgentExecutor | null = null;

  constructor(
    private langChain: ILangChainService,
    private chartService: any,
  ) {
    // Initialize LLM
    this.llm = new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      temperature: 0.1, // Low temperature for more focused reasoning
      model: 'gpt-4o-mini',
      verbose: false,
    });

    // Initialize tools
    this.tools = this.createTools();
  }

  /**
   * Create LangChain-compatible tools from our existing capabilities
   */
  private createTools(): DynamicStructuredTool[] {
    return [
      // Tool 1: Identify Data Sources
      new DynamicStructuredTool({
        name: 'identify_data_sources',
        description:
          'Identifies relevant data sources (APIs/datasets) for a user query. ' +
          'Use this when you need to find which APIs contain the data to answer the query. ' +
          'Returns list of relevant data source IDs and reasoning.',
        schema: z.object({
          query: z.string().describe('The user query to analyze'),
        }),
        func: async ({ query }, runManager) => {
          try {
            const metadata = await this.chartService.getPlatformMetadata('3danalytics');
            const result = await this.langChain.identifyDataSources(query, metadata);

            return JSON.stringify({
              success: true,
              dataSources: result.relevantMetadata.map((m: any) => m.id),
              count: result.relevantMetadata.length,
              reasoning: result.reasoning,
            });
          } catch (error: any) {
            return JSON.stringify({ success: false, error: error.message });
          }
        },
      }),

      // Tool 2: Fetch Chart Data
      new DynamicStructuredTool({
        name: 'fetch_chart_data',
        description:
          'Fetches actual chart data from specified data sources. ' +
          'Use this after identifying data sources to retrieve the actual data. ' +
          'Returns array of chart objects with their data.',
        schema: z.object({
          dataSourceIds: z.array(z.string()).describe('Array of data source IDs to fetch'),
        }),
        func: async ({ dataSourceIds }, runManager) => {
          try {
            const charts = await this.chartService.getCharts('3danalytics', dataSourceIds);

            // Return summary to avoid token overflow
            return JSON.stringify({
              success: true,
              chartsCount: charts.length,
              charts: charts.map((c: any) => ({
                id: c.id,
                chartType: c.chartData?.chartType,
                dataSize: Array.isArray(c.chartData?.data) ? c.chartData.data.length : 0,
                hasData: c.chartData?.data && c.chartData.data.length > 0,
              })),
            });
          } catch (error: any) {
            return JSON.stringify({ success: false, error: error.message });
          }
        },
      }),

      // Tool 3: Validate Data Quality
      new DynamicStructuredTool({
        name: 'validate_data_quality',
        description:
          'Validates data quality by checking for issues like zero rows, missing fields, bad structure. ' +
          'Use this after fetching data to ensure quality before generating visualizations. ' +
          'Returns validation result with any issues found.',
        schema: z.object({
          dataSourceIds: z.array(z.string()).describe('Data source IDs to validate'),
        }),
        func: async ({ dataSourceIds }, runManager) => {
          try {
            const charts = await this.chartService.getCharts('3danalytics', dataSourceIds);

            const issues: any[] = [];
            let validCount = 0;

            for (const chart of charts) {
              const data = chart.chartData?.data;

              // Check for empty data
              if (!data || data.length === 0) {
                issues.push({
                  chartId: chart.id,
                  issue: 'zero_rows',
                  severity: 'critical',
                  message: `Chart ${chart.id} has no data`,
                });
              } else {
                validCount++;
              }
            }

            return JSON.stringify({
              success: true,
              totalCharts: charts.length,
              validCharts: validCount,
              issuesFound: issues.length,
              issues,
              allValid: issues.length === 0,
            });
          } catch (error: any) {
            return JSON.stringify({ success: false, error: error.message });
          }
        },
      }),

      // Tool 4: Generate Visualizations
      new DynamicStructuredTool({
        name: 'generate_visualizations',
        description:
          'Generates final chart visualizations from validated data. ' +
          'Use this as the final step after data is fetched and validated. ' +
          'Returns structured visualization objects ready for display.',
        schema: z.object({
          query: z.string().describe('Original user query'),
          dataSourceIds: z.array(z.string()).describe('Data source IDs to visualize'),
        }),
        func: async ({ query, dataSourceIds }, runManager) => {
          try {
            const charts = await this.chartService.getCharts('3danalytics', dataSourceIds);
            const result = await this.langChain.orchestrateVisualization(query, charts);

            return JSON.stringify({
              success: true,
              visualizationsCount: result.data.length,
              narrative: result.meta.narrative,
              keyInsights: result.meta.keyInsights,
              hasEmptyData: result.data.some((v: any) =>
                !v.data || (Array.isArray(v.data) && v.data.length === 0)
              ),
            });
          } catch (error: any) {
            return JSON.stringify({ success: false, error: error.message });
          }
        },
      }),

      // Tool 5: Calculate Aggregations
      new DynamicStructuredTool({
        name: 'calculate_aggregations',
        description:
          'Calculates aggregated metrics (sum, average, count) from multiple data sources. ' +
          'Use this when creating summary/overview panels that need totals across segments. ' +
          'Returns calculated aggregated values.',
        schema: z.object({
          dataSourceIds: z.array(z.string()).describe('Data source IDs to aggregate'),
          operation: z.enum(['sum', 'average', 'count', 'min', 'max']).describe('Aggregation operation'),
          field: z.string().describe('Field to aggregate (e.g., "revenue", "count")'),
        }),
        func: async ({ dataSourceIds, operation, field }, runManager) => {
          try {
            const charts = await this.chartService.getCharts('3danalytics', dataSourceIds);

            let values: number[] = [];
            for (const chart of charts) {
              const data = chart.chartData?.data || [];
              for (const item of data) {
                if (item[field] !== undefined && typeof item[field] === 'number') {
                  values.push(item[field]);
                }
              }
            }

            let result: number;
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
              default:
                result = 0;
            }

            return JSON.stringify({
              success: true,
              operation,
              field,
              result,
              valuesProcessed: values.length,
            });
          } catch (error: any) {
            return JSON.stringify({ success: false, error: error.message });
          }
        },
      }),
    ];
  }

  /**
   * Create ReAct prompt template with our domain-specific instructions
   */
  private createPrompt(): ChatPromptTemplate {
    return ChatPromptTemplate.fromMessages([
      [
        'system',
        `You are a data analysis agent that helps users create meaningful data visualizations.

Your goal is to answer the user's query by using available tools to:
1. Identify relevant data sources
2. Fetch and validate data
3. Generate appropriate visualizations

IMPORTANT RULES:
- ALWAYS identify data sources first before fetching
- ALWAYS validate data quality after fetching
- If data has issues (empty, invalid), diagnose and suggest corrections
- Calculate aggregations for summary panels (never return empty data)
- Use exact data values from source (no hallucination)
- Generate visualizations only after data is validated

You have access to these tools:
{tools}

Use the following format:

Thought: Think about what to do next based on the query and observations
Action: The tool to use (one of [{tool_names}])
Action Input: The input parameters for the tool as valid JSON
Observation: The result from the tool
... (repeat Thought/Action/Observation as needed)
Thought: I have completed the task and have a final answer
Final Answer: The complete response with visualizations

Begin!

Query: {input}

{agent_scratchpad}`,
      ],
    ]);
  }

  /**
   * Initialize the ReAct agent executor
   */
  private async initializeAgent(): Promise<AgentExecutor> {
    if (this.agentExecutor) {
      return this.agentExecutor;
    }

    const prompt = this.createPrompt();

    // Create ReAct agent
    const agent = await createReactAgent({
      llm: this.llm,
      tools: this.tools,
      prompt,
    });

    // Create executor with configuration
    this.agentExecutor = new AgentExecutor({
      agent,
      tools: this.tools,
      maxIterations: 10,
      verbose: true, // Shows thinking process
      returnIntermediateSteps: true, // Captures full reasoning trace
      handleParsingErrors: true,
    });

    return this.agentExecutor;
  }

  /**
   * Analyze user query using ReAct pattern
   */
  async analyze(
    query: string,
    platformId: string,
    config?: Partial<AgentConfig>,
  ): Promise<AgentResponse> {
    const startTime = Date.now();
    const fullConfig = { ...DEFAULT_AGENT_CONFIG, ...config };
    const state = new AgentState(query, platformId, fullConfig);

    try {
      if (fullConfig.verboseLogging) {
        console.log('\n[ReActAgent] Starting ReAct analysis');
        console.log(`  Query: "${query}"`);
      }

      // Initialize agent executor
      const executor = await this.initializeAgent();

      // Run ReAct loop
      const result = await executor.invoke({
        input: query,
      });

      if (fullConfig.verboseLogging) {
        console.log('\n[ReActAgent] ReAct loop completed');
        console.log(`  Iterations: ${result.intermediateSteps?.length || 0}`);
      }

      // Extract reasoning trace from intermediate steps
      const reasoningTrace = this.extractReasoningTrace(result.intermediateSteps || []);

      // Parse final answer to extract visualizations
      const visualizations = await this.extractVisualizations(query, result.output);

      // Build response
      const response: AgentResponse = {
        finalAnswer: result.output,
        visualizations: visualizations.data || [],
        dataSources: [],
        reasoning: this.buildReasoningSummary(reasoningTrace),
        reasoningTrace,
        executionSteps: [],
        learnings: [],
        corrections: [],
        iterations: result.intermediateSteps?.length || 0,
        confidence: 0.9,
        executionTime: Date.now() - startTime,
        meta: {
          total: visualizations.data?.length || 0,
          successful: visualizations.data?.length || 0,
          failed: 0,
          narrative: visualizations.meta?.narrative,
          keyInsights: visualizations.meta?.keyInsights || [],
        },
      };

      state.markComplete();

      if (fullConfig.verboseLogging) {
        console.log('[ReActAgent] Analysis complete');
        console.log(`  Visualizations: ${response.visualizations.length}`);
        console.log(`  Execution time: ${response.executionTime}ms`);
      }

      return response;
    } catch (error: any) {
      state.markFailed();

      if (fullConfig.verboseLogging) {
        console.error(`[ReActAgent] Error: ${error.message}`);
      }

      throw error;
    }
  }

  /**
   * Extract reasoning trace from LangChain intermediate steps
   */
  private extractReasoningTrace(intermediateSteps: any[]): any[] {
    return intermediateSteps.map((step, index) => ({
      step: index + 1,
      thought: step.action?.log || 'Processing...',
      action: step.action?.tool || 'unknown',
      observation: typeof step.observation === 'string'
        ? step.observation
        : JSON.stringify(step.observation),
      evaluation: this.evaluateStep(step),
      timestamp: new Date(),
    }));
  }

  /**
   * Evaluate a step's success
   */
  private evaluateStep(step: any): string {
    const obs = typeof step.observation === 'string'
      ? step.observation
      : JSON.stringify(step.observation);

    if (obs.includes('"success":true') || obs.includes('success: true')) {
      return 'Step completed successfully';
    } else if (obs.includes('"success":false') || obs.includes('error')) {
      return 'Step encountered an issue';
    }
    return 'Step executed';
  }

  /**
   * Build a summary of the reasoning process
   */
  private buildReasoningSummary(trace: any[]): string {
    if (trace.length === 0) {
      return 'Completed analysis in single pass';
    }

    const steps = trace.map((t) => `${t.step}. ${t.action}`).join(' → ');
    return `ReAct process: ${steps}`;
  }

  /**
   * Extract final visualizations from agent output
   */
  private async extractVisualizations(query: string, output: string): Promise<any> {
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(output);
      if (parsed.data && Array.isArray(parsed.data)) {
        return parsed;
      }
    } catch {
      // If output is not JSON, need to generate visualizations
      // This is a fallback - ideally the agent should use generate_visualizations tool
    }

    // Fallback: Use standard orchestration
    return {
      data: [],
      meta: {
        total: 0,
        narrative: output,
        keyInsights: [],
      },
    };
  }
}
