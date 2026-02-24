/**
 * AgentService - Service layer wrapper for DataAgent
 * Provides backward-compatible interface while enabling agentic capabilities
 */

import { DataAgent } from '../agents/DataAgent';
import { ILangChainService, DataSourceSelection, VisualizationOrchestration } from './LangChainService';
import { AgentConfig, AgentResponse } from '../types/agent.types';

export class AgentService {
  private agent: DataAgent;

  constructor(
    private langChain: ILangChainService,
    private chartService: any,
  ) {
    this.agent = new DataAgent(langChain, chartService);
  }

  /**
   * BACKWARD COMPATIBLE: Mirrors existing LangChainService.identifyDataSources
   * Uses agent with single-pass execution and no self-correction
   */
  async identifyDataSources(
    query: string,
    metadata: any[],
  ): Promise<DataSourceSelection> {
    // Not using full agent for this - just delegate to LangChain
    return this.langChain.identifyDataSources(query, metadata);
  }

  /**
   * BACKWARD COMPATIBLE: Mirrors existing LangChainService.orchestrateVisualization
   * Uses agent with single-pass execution and no self-correction
   */
  async orchestrateVisualization(
    query: string,
    charts: any[],
  ): Promise<VisualizationOrchestration> {
    // Not using full agent for this - just delegate to LangChain
    return this.langChain.orchestrateVisualization(query, charts);
  }

  /**
   * NEW: Advanced agentic interface with full capabilities
   * Enables multi-step reasoning, self-correction, and learning
   */
  async analyzeWithAgent(
    query: string,
    platformId: string,
    config?: Partial<AgentConfig>,
    sessionId?: string,
  ): Promise<AgentResponse> {
    return this.agent.analyze(query, platformId, config, sessionId);
  }

  /**
   * Get memory statistics for monitoring
   */
  getMemoryStats(): any {
    return this.agent.getMemoryStats();
  }

  /**
   * Clear agent memory (useful for testing/debugging)
   */
  clearMemory(): void {
    this.agent.clearMemory();
  }
}
