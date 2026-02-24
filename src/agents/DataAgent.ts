/**
 * DataAgent - Main agentic orchestrator with self-correction and learning
 * Coordinates executors, tools, memory, and evaluation
 */

import { AgentState } from './AgentState';
import { MemoryManager } from './memory/MemoryManager';
import { DataSourceTool } from './tools/DataSourceTool';
import { VisualizationTool } from './tools/VisualizationTool';
import { DataValidationTool } from './tools/DataValidationTool';
import { SinglePassExecutor } from './executors/SinglePassExecutor';
import { IExecutor } from './executors/IExecutor';
import {
  AgentConfig,
  AgentResponse,
  QueryComplexity,
  DEFAULT_AGENT_CONFIG,
} from '../types/agent.types';
import { ILangChainService } from '../services/LangChainService';

export class DataAgent {
  private memory: MemoryManager;
  private dataSourceTool: DataSourceTool;
  private visualizationTool: VisualizationTool;
  private dataValidationTool: DataValidationTool;

  constructor(
    private langChain: ILangChainService,
    private chartService: any,
  ) {
    // Initialize memory system
    this.memory = new MemoryManager(false);

    // Initialize tools
    this.dataSourceTool = new DataSourceTool(langChain);
    this.visualizationTool = new VisualizationTool(langChain);
    this.dataValidationTool = new DataValidationTool();
  }

  /**
   * Main entry point for agent analysis
   * Maintains backward compatible signature for easy integration
   */
  async analyze(
    query: string,
    platformId: string,
    config?: Partial<AgentConfig>,
    sessionId?: string,
  ): Promise<AgentResponse> {
    // Merge config with defaults
    const fullConfig = { ...DEFAULT_AGENT_CONFIG, ...config };

    // Initialize state
    const state = new AgentState(query, platformId, fullConfig);

    try {
      if (fullConfig.verboseLogging) {
        console.log(`\n[DataAgent] Starting analysis`);
        console.log(`  Query: "${query}"`);
        console.log(`  Platform: ${platformId}`);
        console.log(`  Config: ${JSON.stringify(fullConfig)}`);
      }

      // Get context from memory
      if (fullConfig.enableLearning) {
        const context = await this.memory.getContextForQuery(query, sessionId);

        if (context.relevantPatterns.length > 0 && fullConfig.verboseLogging) {
          console.log(
            `[DataAgent] Recalled ${context.relevantPatterns.length} relevant patterns`,
          );
        }

        // Add context as learning
        if (context.successfulApproaches.length > 0) {
          state.addLearning({
            type: 'pattern',
            description: `Recalled successful approaches: ${context.successfulApproaches.join('; ')}`,
            context: context.relevantPatterns,
            confidence: 0.8,
            timestamp: new Date(),
          });
        }
      }

      // Assess query complexity
      const complexity = this.assessComplexity(query);

      if (fullConfig.verboseLogging) {
        console.log(`[DataAgent] Query complexity: ${complexity}`);
      }

      // Select appropriate executor
      const executor = this.selectExecutor(complexity, fullConfig);

      if (fullConfig.verboseLogging) {
        console.log(`[DataAgent] Using executor: ${executor.name}`);
      }

      // Execute with selected strategy
      const result = await executor.execute(state);

      // Store execution in memory
      if (fullConfig.enableLearning && result.visualizations.length > 0) {
        await this.memory.storeExecution(query, result, sessionId);

        if (fullConfig.verboseLogging) {
          console.log('[DataAgent] Stored execution in memory');
        }
      }

      if (fullConfig.verboseLogging) {
        console.log(`[DataAgent] Analysis complete`);
        console.log(`  Status: ${state.status}`);
        console.log(`  Confidence: ${(result.confidence * 100).toFixed(1)}%`);
        console.log(`  Iterations: ${result.iterations}`);
        console.log(`  Execution time: ${result.executionTime}ms`);
        console.log(`  Visualizations: ${result.visualizations.length}`);
      }

      return result;
    } catch (error: any) {
      // Store failure in memory
      if (fullConfig.enableLearning) {
        await this.memory.storeFailure(query, error);
      }

      if (fullConfig.verboseLogging) {
        console.error(`[DataAgent] Analysis failed: ${error.message}`);
      }

      throw error;
    }
  }

  /**
   * Assess query complexity using heuristics
   * Future: Use ML model for better classification
   */
  private assessComplexity(query: string): QueryComplexity {
    // Simple heuristics for now
    const words = query.toLowerCase().split(/\s+/);
    const questionWords = [
      'which',
      'what',
      'how',
      'why',
      'when',
      'where',
      'who',
    ];
    const complexIndicators = [
      'compare',
      'analyze',
      'breakdown',
      'correlation',
      'relationship',
      'trend',
      'pattern',
      'predict',
      'forecast',
      'largest',
      'smallest',
      'gap',
      'difference',
    ];
    const multiStepIndicators = ['and', 'then', 'also', 'plus', 'additionally'];

    // Count indicators
    const hasQuestion = questionWords.some((w) => words.includes(w));
    const complexCount = complexIndicators.filter((w) => words.includes(w))
      .length;
    const multiStepCount = multiStepIndicators.filter((w) => words.includes(w))
      .length;
    const wordCount = words.length;

    // Classify
    if (complexCount >= 2 || multiStepCount >= 2) {
      return 'very_complex';
    }

    if (complexCount >= 1 || multiStepCount >= 1 || wordCount > 15) {
      return 'complex';
    }

    if (hasQuestion || wordCount > 8) {
      return 'medium';
    }

    return 'simple';
  }

  /**
   * Select appropriate executor based on complexity and config
   */
  private selectExecutor(
    complexity: QueryComplexity,
    config: AgentConfig,
  ): IExecutor {
    // For now, always use SinglePassExecutor for stability
    // Future: Add MultiStepExecutor and ReasoningExecutor
    return new SinglePassExecutor(
      this.dataSourceTool,
      this.visualizationTool,
      this.dataValidationTool,
      this.chartService,
    );

    // Future implementation:
    // if (complexity === 'simple' || !config.enableSelfCorrection) {
    //   return new SinglePassExecutor(...);
    // } else if (complexity === 'medium' || complexity === 'complex') {
    //   return new MultiStepExecutor(...);
    // } else {
    //   return new ReasoningExecutor(...);
    // }
  }

  /**
   * Get memory statistics
   */
  getMemoryStats(): any {
    return this.memory.getStats();
  }

  /**
   * Clear all memory (useful for testing)
   */
  clearMemory(): void {
    this.memory.clearAll();
  }
}
