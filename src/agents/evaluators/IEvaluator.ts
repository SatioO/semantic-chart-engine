/**
 * IEvaluator - Interface for evaluating execution results
 * Evaluators assess quality, relevance, and completeness of results
 */

import { EvaluationResult } from '../../types/agent.types';
import { AgentState } from '../AgentState';

export interface IEvaluator {
  /** Unique evaluator name */
  name: string;

  /** Description of what this evaluator checks */
  description: string;

  /**
   * Evaluate a result
   * @param result - The result to evaluate
   * @param state - Current agent state for context
   * @returns Evaluation result with score and issues
   */
  evaluate(result: any, state: AgentState): Promise<EvaluationResult>;
}

/**
 * Base abstract class for evaluators with common functionality
 */
export abstract class BaseEvaluator implements IEvaluator {
  abstract name: string;
  abstract description: string;

  abstract evaluate(
    result: any,
    state: AgentState,
  ): Promise<EvaluationResult>;

  protected logVerbose(message: string, state: AgentState): void {
    if (state.config.verboseLogging) {
      console.log(`[Evaluator:${this.name}] ${message}`);
    }
  }

  protected createResult(
    score: number,
    passed: boolean,
    issues: any[] = [],
  ): EvaluationResult {
    return {
      score: Math.max(0, Math.min(1, score)),
      passed,
      issues,
      details: {
        evaluator: this.name,
        timestamp: new Date(),
      },
    };
  }
}
