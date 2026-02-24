/**
 * IExecutor - Interface for execution strategies
 * Executors determine how the agent runs (single-pass, multi-step, self-correcting)
 */

import { AgentState } from '../AgentState';
import { AgentResponse } from '../../types/agent.types';

export interface IExecutor {
  /** Unique executor name */
  name: string;

  /** Description of execution strategy */
  description: string;

  /**
   * Execute the analysis using this strategy
   * @param state - Agent state containing query, config, etc.
   * @returns Complete agent response
   */
  execute(state: AgentState): Promise<AgentResponse>;
}
