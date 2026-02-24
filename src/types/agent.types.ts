/**
 * Agent Types - Core type definitions for the agentic data agent system
 * Enables multi-step reasoning, self-correction, and continuous learning
 */

import {
  ChartVisualization,
  DataSourceMetadata,
} from './chart.types';

// ============================================================================
// Configuration
// ============================================================================

export interface AgentConfig {
  /** Maximum number of reasoning loop iterations before stopping */
  maxIterations: number;
  /** Minimum confidence score (0-1) required to accept a result */
  minConfidence: number;
  /** Whether to store learnings in memory for future queries */
  enableLearning: boolean;
  /** Whether to attempt self-correction when issues are detected */
  enableSelfCorrection: boolean;
  /** Enable detailed logging of reasoning process */
  verboseLogging: boolean;
  /** Timeout for entire analysis in milliseconds */
  timeoutMs: number;
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  maxIterations: 5,
  minConfidence: 0.7,
  enableLearning: true,
  enableSelfCorrection: true,
  verboseLogging: false,
  timeoutMs: 60000, // 60 seconds
};

// ============================================================================
// Agent Response
// ============================================================================

export interface AgentResponse {
  /** Final synthesized answer to the user query */
  finalAnswer: string;
  /** Generated chart visualizations */
  visualizations: ChartVisualization[];
  /** Data sources used in the analysis */
  dataSources: DataSourceMetadata[];
  /** High-level reasoning summary */
  reasoning: string;
  /** Detailed step-by-step reasoning trace */
  reasoningTrace: ReasoningStep[];
  /** Execution steps taken by the agent */
  executionSteps: ExecutionStep[];
  /** Learnings extracted from this execution */
  learnings: Learning[];
  /** Self-corrections applied during execution */
  corrections: Correction[];
  /** Number of reasoning iterations performed */
  iterations: number;
  /** Overall confidence in the result (0-1) */
  confidence: number;
  /** Total execution time in milliseconds */
  executionTime: number;
  /** Additional metadata */
  meta: {
    total: number;
    successful: number;
    failed: number;
    narrative?: string;
    keyInsights?: string[];
  };
}

// ============================================================================
// Execution State
// ============================================================================

export type ExecutionStatus =
  | 'planning'
  | 'executing'
  | 'evaluating'
  | 'correcting'
  | 'synthesizing'
  | 'complete'
  | 'failed';

export interface ExecutionStep {
  /** Unique identifier for this step */
  id: string;
  /** Type of step being executed */
  type: StepType;
  /** Step number in the sequence */
  stepNumber: number;
  /** Input data for this step */
  input: any;
  /** Output data from this step */
  output: any;
  /** Evaluation result of this step */
  evaluation: StepEvaluation;
  /** Timestamp when step started */
  startedAt: Date;
  /** Timestamp when step completed */
  completedAt?: Date;
  /** Duration in milliseconds */
  durationMs?: number;
  /** Tool used for this step */
  tool?: string;
}

export type StepType =
  | 'decompose'
  | 'identify'
  | 'fetch'
  | 'validate'
  | 'transform'
  | 'synthesize'
  | 'correct';

export interface StepEvaluation {
  /** Whether the step succeeded */
  success: boolean;
  /** Confidence in the result (0-1) */
  confidence: number;
  /** Issues detected during evaluation */
  issues: Issue[];
  /** Suggested corrections */
  corrections: Correction[];
}

// ============================================================================
// Issues and Corrections
// ============================================================================

export type IssueType =
  | 'zero_rows'
  | 'missing_data'
  | 'irrelevant'
  | 'incomplete'
  | 'invalid_structure'
  | 'error'
  | 'timeout';

export type IssueSeverity = 'critical' | 'warning' | 'info';

export interface Issue {
  /** Type of issue detected */
  type: IssueType;
  /** Severity level of the issue */
  severity: IssueSeverity;
  /** Human-readable description */
  description: string;
  /** Optional suggested fix */
  suggestedFix?: string;
  /** Additional context about the issue */
  context?: any;
}

export interface Correction {
  /** Issue being corrected */
  issue: Issue;
  /** Action taken to correct the issue */
  action: string;
  /** Result of the correction attempt */
  result: 'success' | 'failure';
  /** Reasoning behind the correction */
  reasoning: string;
  /** Timestamp of correction */
  timestamp: Date;
}

// ============================================================================
// Reasoning
// ============================================================================

export interface ReasoningStep {
  /** Step number in reasoning process */
  step: number;
  /** What the agent is thinking */
  thought: string;
  /** What action the agent plans to take */
  action: string;
  /** What the agent observed from the action */
  observation: string;
  /** Agent's evaluation of the observation */
  evaluation: string;
  /** Timestamp of this reasoning step */
  timestamp: Date;
}

export interface Action {
  /** Type of action to execute */
  type: StepType;
  /** Tool to use for this action */
  tool: string;
  /** Input parameters for the tool */
  input: any;
  /** Expected output structure */
  expectedOutput?: any;
  /** Priority of this action */
  priority?: number;
}

// ============================================================================
// Learning and Memory
// ============================================================================

export type LearningType = 'success' | 'failure' | 'pattern' | 'correction';

export interface Learning {
  /** Type of learning */
  type: LearningType;
  /** Description of what was learned */
  description: string;
  /** Context in which this was learned */
  context: any;
  /** Confidence in this learning (0-1) */
  confidence: number;
  /** Timestamp when learned */
  timestamp: Date;
}

export interface Pattern {
  /** Type of pattern (success or failure) */
  type: 'success' | 'failure';
  /** Original query that led to this pattern */
  query: string;
  /** Execution steps that were taken */
  steps?: ExecutionStep[];
  /** Result of the execution */
  result?: any;
  /** Error if pattern was a failure */
  error?: string;
  /** Correction applied if pattern was a failure */
  correction?: Correction;
  /** Additional metadata */
  metadata?: any;
  /** Timestamp of the pattern */
  timestamp: Date;
  /** How many times this pattern has been observed */
  frequency?: number;
}

export interface ConversationMessage {
  /** Role of the message sender */
  role: 'user' | 'assistant' | 'system';
  /** Content of the message */
  content: string;
  /** Timestamp of the message */
  timestamp: Date;
  /** Additional metadata */
  metadata?: any;
}

// ============================================================================
// Tool System
// ============================================================================

export interface ToolInput {
  /** Query or task description */
  query?: string;
  /** Data to process */
  data?: any;
  /** Metadata for context */
  metadata?: any;
  /** Expected fields in the output */
  expectedFields?: string[];
  /** Additional parameters */
  params?: any;
}

export interface ToolOutput {
  /** Success status */
  success: boolean;
  /** Output data */
  data?: any;
  /** Error message if failed */
  error?: string;
  /** Confidence in the output (0-1) */
  confidence?: number;
  /** Issues detected */
  issues?: Issue[];
  /** Additional metadata */
  metadata?: any;
}

export interface ToolContext {
  /** Current agent state */
  state: any;
  /** Memory manager for accessing learnings */
  memory?: any;
  /** Configuration */
  config: AgentConfig;
}

export interface ToolSchema {
  /** Tool name */
  name: string;
  /** Tool description for LLM planning */
  description: string;
  /** Input schema */
  inputSchema: any;
  /** Output schema */
  outputSchema: any;
  /** Example usage */
  examples?: Array<{ input: any; output: any }>;
}

// ============================================================================
// Evaluation
// ============================================================================

export interface EvaluationResult {
  /** Overall score (0-1) */
  score: number;
  /** Whether evaluation passed */
  passed: boolean;
  /** Issues found during evaluation */
  issues: Issue[];
  /** Detailed evaluation breakdown */
  details?: any;
}

// ============================================================================
// Query Analysis
// ============================================================================

export type QueryComplexity = 'simple' | 'medium' | 'complex' | 'very_complex';

export interface QueryAnalysis {
  /** Complexity assessment */
  complexity: QueryComplexity;
  /** Estimated number of steps required */
  estimatedSteps: number;
  /** Whether query requires multiple data sources */
  requiresMultipleSources: boolean;
  /** Whether query requires sequential steps */
  requiresSequential: boolean;
  /** Key entities/concepts mentioned */
  entities: string[];
  /** Intent classification */
  intent: string;
}

export interface DecomposedQuery {
  /** Original query */
  originalQuery: string;
  /** Broken down sub-queries */
  steps: QueryStep[];
  /** Whether steps must be executed in order */
  requiresSequential: boolean;
  /** Estimated overall complexity */
  estimatedComplexity: QueryComplexity;
}

export interface QueryStep {
  /** Step number */
  stepNumber: number;
  /** Step description */
  description: string;
  /** What data sources to use */
  dataSources: string[];
  /** What transformations to apply */
  transformations?: string[];
  /** What to validate */
  validations?: string[];
  /** Dependencies on previous steps */
  dependencies: number[];
}
