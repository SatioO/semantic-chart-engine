/**
 * IAgentTool - Interface for all agent tools
 * Tools are specialized actions the agent can execute
 */

import {
  ToolInput,
  ToolOutput,
  ToolContext,
  ToolSchema,
} from '../../types/agent.types';

export interface IAgentTool {
  /** Unique tool name */
  name: string;

  /** Human-readable description for LLM planning */
  description: string;

  /** Execute the tool with given input and context */
  execute(input: ToolInput, context: ToolContext): Promise<ToolOutput>;

  /** Get tool schema for LLM understanding */
  getSchema(): ToolSchema;

  /** Optional: Validate input before execution */
  validateInput?(input: ToolInput): { valid: boolean; error?: string };
}

/**
 * Base abstract class for tools with common functionality
 */
export abstract class BaseTool implements IAgentTool {
  abstract name: string;
  abstract description: string;

  abstract execute(
    input: ToolInput,
    context: ToolContext,
  ): Promise<ToolOutput>;

  getSchema(): ToolSchema {
    return {
      name: this.name,
      description: this.description,
      inputSchema: this.getInputSchema(),
      outputSchema: this.getOutputSchema(),
      examples: this.getExamples(),
    };
  }

  protected abstract getInputSchema(): any;
  protected abstract getOutputSchema(): any;
  protected getExamples(): Array<{ input: any; output: any }> {
    return [];
  }

  protected logVerbose(message: string, context: ToolContext): void {
    if (context.config.verboseLogging) {
      console.log(`[Tool:${this.name}] ${message}`);
    }
  }

  protected createSuccessOutput(data: any, confidence: number = 1.0): ToolOutput {
    return {
      success: true,
      data,
      confidence,
      issues: [],
    };
  }

  protected createErrorOutput(error: string): ToolOutput {
    return {
      success: false,
      error,
      confidence: 0,
      issues: [
        {
          type: 'error',
          severity: 'critical',
          description: error,
        },
      ],
    };
  }
}
