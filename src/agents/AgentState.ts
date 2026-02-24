/**
 * AgentState - Manages the evolving state during agent execution
 * Tracks steps, learnings, data, and reasoning progress
 */

import {
  AgentConfig,
  ExecutionStep,
  ExecutionStatus,
  Learning,
  Issue,
  ReasoningStep,
  DEFAULT_AGENT_CONFIG,
} from '../types/agent.types';

export class AgentState {
  // Core query information
  public readonly query: string;
  public readonly platformId: string;
  public readonly config: AgentConfig;

  // Execution tracking
  public status: ExecutionStatus;
  public currentIteration: number;
  public startTime: Date;
  public endTime?: Date;

  // Execution history
  public steps: ExecutionStep[];
  public reasoningTrace: ReasoningStep[];
  public learnings: Learning[];

  // Data collection
  public collectedData: Map<string, any>;
  public dataSources: Set<string>;

  // Quality tracking
  public overallConfidence: number;
  public criticalIssues: Issue[];

  constructor(
    query: string,
    platformId: string,
    config?: Partial<AgentConfig>,
  ) {
    this.query = query;
    this.platformId = platformId;
    this.config = { ...DEFAULT_AGENT_CONFIG, ...config };

    this.status = 'planning';
    this.currentIteration = 0;
    this.startTime = new Date();

    this.steps = [];
    this.reasoningTrace = [];
    this.learnings = [];

    this.collectedData = new Map();
    this.dataSources = new Set();

    this.overallConfidence = 0;
    this.criticalIssues = [];
  }

  /**
   * Add an execution step to the history
   */
  addStep(step: ExecutionStep): void {
    this.steps.push(step);

    // Update collected data if step has output
    if (step.output && step.id) {
      this.collectedData.set(step.id, step.output);
    }

    // Track critical issues
    if (step.evaluation?.issues) {
      const critical = step.evaluation.issues.filter(
        (i) => i.severity === 'critical',
      );
      this.criticalIssues.push(...critical);
    }

    // Update overall confidence (weighted average)
    this.updateConfidence();
  }

  /**
   * Add a reasoning step to the trace
   */
  addReasoningStep(reasoning: ReasoningStep): void {
    this.reasoningTrace.push(reasoning);

    if (this.config.verboseLogging) {
      console.log(`[Agent Reasoning ${reasoning.step}]`);
      console.log(`  Thought: ${reasoning.thought}`);
      console.log(`  Action: ${reasoning.action}`);
      console.log(`  Observation: ${reasoning.observation}`);
      console.log(`  Evaluation: ${reasoning.evaluation}`);
    }
  }

  /**
   * Add a learning from this execution
   */
  addLearning(learning: Learning): void {
    this.learnings.push(learning);

    if (this.config.verboseLogging) {
      console.log(
        `[Agent Learning] ${learning.type}: ${learning.description}`,
      );
    }
  }

  /**
   * Add a data source to the tracking set
   */
  addDataSource(dataSourceId: string): void {
    this.dataSources.add(dataSourceId);
  }

  /**
   * Increment iteration counter
   */
  incrementIteration(): void {
    this.currentIteration++;
  }

  /**
   * Check if agent should continue executing
   */
  shouldContinue(): boolean {
    // Stop if max iterations reached
    if (this.currentIteration >= this.config.maxIterations) {
      if (this.config.verboseLogging) {
        console.log('[Agent] Max iterations reached, stopping');
      }
      return false;
    }

    // Stop if timeout exceeded
    const elapsed = Date.now() - this.startTime.getTime();
    if (elapsed > this.config.timeoutMs) {
      if (this.config.verboseLogging) {
        console.log('[Agent] Timeout reached, stopping');
      }
      return false;
    }

    // Stop if confidence is very high and no critical issues
    if (
      this.overallConfidence >= 0.95 &&
      this.criticalIssues.length === 0
    ) {
      if (this.config.verboseLogging) {
        console.log('[Agent] High confidence achieved, stopping');
      }
      return false;
    }

    // Stop if status is complete or failed
    if (this.status === 'complete' || this.status === 'failed') {
      return false;
    }

    return true;
  }

  /**
   * Check if there are critical issues that need correction
   */
  hasCriticalIssues(): boolean {
    return this.criticalIssues.length > 0;
  }

  /**
   * Mark the execution as complete
   */
  markComplete(): void {
    this.status = 'complete';
    this.endTime = new Date();
  }

  /**
   * Mark the execution as failed
   */
  markFailed(): void {
    this.status = 'failed';
    this.endTime = new Date();
  }

  /**
   * Get execution duration in milliseconds
   */
  getExecutionTime(): number {
    const end = this.endTime || new Date();
    return end.getTime() - this.startTime.getTime();
  }

  /**
   * Get successful steps count
   */
  getSuccessfulStepsCount(): number {
    return this.steps.filter((s) => s.evaluation?.success).length;
  }

  /**
   * Get failed steps count
   */
  getFailedStepsCount(): number {
    return this.steps.filter((s) => !s.evaluation?.success).length;
  }

  /**
   * Get the most recent step
   */
  getLastStep(): ExecutionStep | undefined {
    return this.steps[this.steps.length - 1];
  }

  /**
   * Get all data collected so far
   */
  getAllCollectedData(): any[] {
    return Array.from(this.collectedData.values());
  }

  /**
   * Update overall confidence based on step evaluations
   */
  private updateConfidence(): void {
    if (this.steps.length === 0) {
      this.overallConfidence = 0;
      return;
    }

    // Weighted average of step confidences
    const totalConfidence = this.steps.reduce((sum, step) => {
      return sum + (step.evaluation?.confidence || 0);
    }, 0);

    this.overallConfidence = totalConfidence / this.steps.length;

    // Penalize for critical issues
    const issuePenalty = Math.min(this.criticalIssues.length * 0.1, 0.5);
    this.overallConfidence = Math.max(
      0,
      this.overallConfidence - issuePenalty,
    );
  }

  /**
   * Get a summary of the current state
   */
  getSummary(): string {
    const elapsed = this.getExecutionTime();
    const successful = this.getSuccessfulStepsCount();
    const failed = this.getFailedStepsCount();

    return `Query: "${this.query}" | Status: ${this.status} | Iteration: ${this.currentIteration}/${this.config.maxIterations} | Steps: ${successful} successful, ${failed} failed | Confidence: ${(this.overallConfidence * 100).toFixed(1)}% | Elapsed: ${elapsed}ms`;
  }
}
