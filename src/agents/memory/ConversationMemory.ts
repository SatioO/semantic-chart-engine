/**
 * ConversationMemory - Stores conversation history across interactions
 * Enables context retention for follow-up questions
 */

import { ConversationMessage } from '../../types/agent.types';

export class ConversationMemory {
  private conversations: Map<string, ConversationMessage[]>;
  private maxMessagesPerSession: number;

  constructor(maxMessagesPerSession: number = 50) {
    this.conversations = new Map();
    this.maxMessagesPerSession = maxMessagesPerSession;
  }

  /**
   * Add a message to a conversation session
   */
  addMessage(
    sessionId: string,
    message: ConversationMessage,
  ): void {
    if (!this.conversations.has(sessionId)) {
      this.conversations.set(sessionId, []);
    }

    const messages = this.conversations.get(sessionId)!;
    messages.push(message);

    // Trim if exceeds max
    if (messages.length > this.maxMessagesPerSession) {
      // Keep the most recent messages
      this.conversations.set(
        sessionId,
        messages.slice(-this.maxMessagesPerSession),
      );
    }
  }

  /**
   * Get conversation history for a session
   */
  getHistory(sessionId?: string): ConversationMessage[] {
    if (!sessionId) {
      // Return all messages from all sessions (for debugging)
      const allMessages: ConversationMessage[] = [];
      this.conversations.forEach((messages) => {
        allMessages.push(...messages);
      });
      return allMessages.sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
      );
    }

    return this.conversations.get(sessionId) || [];
  }

  /**
   * Get recent messages from a session
   */
  getRecentMessages(
    sessionId: string,
    count: number = 10,
  ): ConversationMessage[] {
    const messages = this.conversations.get(sessionId) || [];
    return messages.slice(-count);
  }

  /**
   * Clear conversation history for a session
   */
  clearSession(sessionId: string): void {
    this.conversations.delete(sessionId);
  }

  /**
   * Clear all conversations
   */
  clearAll(): void {
    this.conversations.clear();
  }

  /**
   * Get number of active sessions
   */
  getSessionCount(): number {
    return this.conversations.size;
  }

  /**
   * Get total message count across all sessions
   */
  getTotalMessageCount(): number {
    let total = 0;
    this.conversations.forEach((messages) => {
      total += messages.length;
    });
    return total;
  }
}
