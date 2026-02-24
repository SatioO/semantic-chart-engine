/**
 * MemoryManager - Unified memory management for learning and context
 * Coordinates PatternMemory and ConversationMemory
 */

import { PatternMemory } from './PatternMemory';
import { ConversationMemory } from './ConversationMemory';
import {
  Pattern,
  ConversationMessage,
  ExecutionStep,
  Correction,
} from '../../types/agent.types';

export interface ExecutionTrace {
  query: string;
  steps: ExecutionStep[];
  result: any;
  metadata?: any;
}

export class MemoryManager {
  private patternMemory: PatternMemory;
  private conversationMemory: ConversationMemory;
  private readonly verboseLogging: boolean;

  constructor(verboseLogging: boolean = false) {
    this.patternMemory = new PatternMemory();
    this.conversationMemory = new ConversationMemory();
    this.verboseLogging = verboseLogging;
  }

  // ========================================================================
  // Pattern Memory Operations
  // ========================================================================

  /**
   * Store a successful execution pattern for future reference
   */
  async storeSuccess(
    query: string,
    execution: ExecutionTrace,
  ): Promise<void> {
    const pattern: Pattern = {
      type: 'success',
      query,
      steps: execution.steps,
      result: execution.result,
      metadata: execution.metadata,
      timestamp: new Date(),
    };

    await this.patternMemory.addPattern(pattern);

    if (this.verboseLogging) {
      console.log(`[Memory] Stored successful pattern for query: "${query}"`);
    }
  }

  /**
   * Store a failed execution and its correction (if any)
   */
  async storeFailure(
    query: string,
    error: Error,
    correction?: Correction,
  ): Promise<void> {
    const pattern: Pattern = {
      type: 'failure',
      query,
      error: error.message,
      correction,
      timestamp: new Date(),
    };

    await this.patternMemory.addPattern(pattern);

    if (this.verboseLogging) {
      console.log(
        `[Memory] Stored failure pattern for query: "${query}" - Error: ${error.message}`,
      );
    }
  }

  /**
   * Retrieve relevant learned patterns for the current query
   */
  async recallRelevantPatterns(
    query: string,
    options: { limit?: number; type?: 'success' | 'failure' } = {},
  ): Promise<Pattern[]> {
    const patterns = await this.patternMemory.findSimilar(query, options);

    if (this.verboseLogging && patterns.length > 0) {
      console.log(
        `[Memory] Recalled ${patterns.length} relevant patterns for query: "${query}"`,
      );
    }

    return patterns;
  }

  /**
   * Get the most successful execution patterns
   */
  async getTopSuccessPatterns(limit: number = 10): Promise<Pattern[]> {
    return this.patternMemory.getTopSuccessPatterns(limit);
  }

  /**
   * Get common failure patterns to avoid
   */
  async getCommonFailures(limit: number = 10): Promise<Pattern[]> {
    return this.patternMemory.getCommonFailures(limit);
  }

  /**
   * Get pattern memory statistics
   */
  getPatternStats(): {
    total: number;
    successes: number;
    failures: number;
    mostFrequent?: Pattern;
  } {
    return this.patternMemory.getStats();
  }

  // ========================================================================
  // Conversation Memory Operations
  // ========================================================================

  /**
   * Add a message to conversation history
   */
  addConversationMessage(
    sessionId: string,
    message: ConversationMessage,
  ): void {
    this.conversationMemory.addMessage(sessionId, message);

    if (this.verboseLogging) {
      console.log(
        `[Memory] Added ${message.role} message to session ${sessionId}`,
      );
    }
  }

  /**
   * Get conversation history for a session
   */
  getConversationHistory(sessionId?: string): ConversationMessage[] {
    return this.conversationMemory.getHistory(sessionId);
  }

  /**
   * Get recent messages from a session
   */
  getRecentMessages(
    sessionId: string,
    count: number = 10,
  ): ConversationMessage[] {
    return this.conversationMemory.getRecentMessages(sessionId, count);
  }

  /**
   * Clear conversation history for a session
   */
  clearSession(sessionId: string): void {
    this.conversationMemory.clearSession(sessionId);

    if (this.verboseLogging) {
      console.log(`[Memory] Cleared conversation for session ${sessionId}`);
    }
  }

  // ========================================================================
  // Composite Operations
  // ========================================================================

  /**
   * Store complete execution (both pattern and conversation)
   */
  async storeExecution(
    query: string,
    result: any,
    sessionId?: string,
  ): Promise<void> {
    // Store as successful pattern
    if (result.success !== false) {
      await this.storeSuccess(query, {
        query,
        steps: result.executionSteps || [],
        result,
        metadata: result.meta,
      });
    } else {
      await this.storeFailure(
        query,
        new Error(result.error || 'Unknown error'),
      );
    }

    // Store in conversation if session provided
    if (sessionId) {
      this.addConversationMessage(sessionId, {
        role: 'user',
        content: query,
        timestamp: new Date(),
      });

      this.addConversationMessage(sessionId, {
        role: 'assistant',
        content:
          result.finalAnswer || JSON.stringify(result.visualizations || []),
        timestamp: new Date(),
        metadata: result.meta,
      });
    }
  }

  /**
   * Get contextual information for a query
   * Combines relevant patterns and recent conversation
   */
  async getContextForQuery(
    query: string,
    sessionId?: string,
  ): Promise<{
    relevantPatterns: Pattern[];
    recentConversation: ConversationMessage[];
    successfulApproaches: string[];
    commonPitfalls: string[];
  }> {
    // Get relevant patterns
    const relevantPatterns = await this.recallRelevantPatterns(query, {
      limit: 5,
    });

    // Get recent conversation
    const recentConversation = sessionId
      ? this.getRecentMessages(sessionId, 5)
      : [];

    // Extract successful approaches
    const successfulApproaches = relevantPatterns
      .filter((p) => p.type === 'success')
      .map(
        (p) =>
          p.metadata?.approach ||
          `Previous similar query: "${p.query}" was successful`,
      )
      .slice(0, 3);

    // Extract common pitfalls
    const commonPitfalls = relevantPatterns
      .filter((p) => p.type === 'failure')
      .map(
        (p) =>
          p.correction?.reasoning ||
          p.error ||
          `Previous similar query: "${p.query}" failed`,
      )
      .slice(0, 3);

    return {
      relevantPatterns,
      recentConversation,
      successfulApproaches,
      commonPitfalls,
    };
  }

  /**
   * Clear all memory (useful for testing)
   */
  clearAll(): void {
    this.patternMemory.clear();
    this.conversationMemory.clearAll();

    if (this.verboseLogging) {
      console.log('[Memory] Cleared all memory');
    }
  }

  /**
   * Get comprehensive memory statistics
   */
  getStats(): {
    patterns: ReturnType<PatternMemory['getStats']>;
    conversations: {
      sessions: number;
      totalMessages: number;
    };
  } {
    return {
      patterns: this.patternMemory.getStats(),
      conversations: {
        sessions: this.conversationMemory.getSessionCount(),
        totalMessages: this.conversationMemory.getTotalMessageCount(),
      },
    };
  }
}
