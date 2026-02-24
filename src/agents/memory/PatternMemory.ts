/**
 * PatternMemory - Stores and retrieves learned patterns from past executions
 * Enables the agent to learn from successes and failures
 */

import { Pattern } from '../../types/agent.types';

export class PatternMemory {
  private patterns: Pattern[] = [];
  private maxPatterns: number;

  constructor(maxPatterns: number = 1000) {
    this.maxPatterns = maxPatterns;
  }

  /**
   * Add a new pattern to memory
   */
  async addPattern(pattern: Pattern): Promise<void> {
    // Check if similar pattern already exists
    const existing = this.findExactMatch(pattern.query, pattern.type);

    if (existing) {
      // Increment frequency instead of adding duplicate
      existing.frequency = (existing.frequency || 1) + 1;
      existing.timestamp = pattern.timestamp;
    } else {
      // Add new pattern
      this.patterns.push({
        ...pattern,
        frequency: 1,
      });
    }

    // Trim if exceeds max
    if (this.patterns.length > this.maxPatterns) {
      this.trimOldest();
    }

    // Optional: Persist to storage (future enhancement)
    // await this.persist();
  }

  /**
   * Find patterns similar to the given query
   */
  async findSimilar(
    query: string,
    options: { limit?: number; minSimilarity?: number; type?: 'success' | 'failure' } = {},
  ): Promise<Pattern[]> {
    const { limit = 5, minSimilarity = 0.6, type } = options;

    // Filter by type if specified
    let candidates = type
      ? this.patterns.filter((p) => p.type === type)
      : this.patterns;

    // Calculate similarity scores
    const scored = candidates.map((pattern) => ({
      pattern,
      similarity: this.calculateSimilarity(query, pattern.query),
    }));

    // Filter by minimum similarity and sort
    return scored
      .filter((s) => s.similarity >= minSimilarity)
      .sort((a, b) => {
        // Sort by similarity first, then by frequency, then by recency
        if (Math.abs(a.similarity - b.similarity) > 0.1) {
          return b.similarity - a.similarity;
        }
        if (a.pattern.frequency !== b.pattern.frequency) {
          return (b.pattern.frequency || 1) - (a.pattern.frequency || 1);
        }
        return (
          b.pattern.timestamp.getTime() - a.pattern.timestamp.getTime()
        );
      })
      .slice(0, limit)
      .map((s) => s.pattern);
  }

  /**
   * Get the most successful patterns
   */
  async getTopSuccessPatterns(limit: number = 10): Promise<Pattern[]> {
    return this.patterns
      .filter((p) => p.type === 'success')
      .sort((a, b) => (b.frequency || 1) - (a.frequency || 1))
      .slice(0, limit);
  }

  /**
   * Get common failure patterns to avoid
   */
  async getCommonFailures(limit: number = 10): Promise<Pattern[]> {
    return this.patterns
      .filter((p) => p.type === 'failure')
      .sort((a, b) => (b.frequency || 1) - (a.frequency || 1))
      .slice(0, limit);
  }

  /**
   * Calculate Jaccard similarity between two queries
   */
  private calculateSimilarity(query1: string, query2: string): number {
    // Normalize and tokenize
    const tokens1 = this.tokenize(query1);
    const tokens2 = this.tokenize(query2);

    // Convert to sets
    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);

    // Calculate intersection and union
    const intersection = new Set([...set1].filter((x) => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    // Jaccard similarity
    if (union.size === 0) return 0;
    return intersection.size / union.size;
  }

  /**
   * Tokenize a query into normalized words
   */
  private tokenize(query: string): string[] {
    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2); // Filter out very short words
  }

  /**
   * Find exact match by query and type
   */
  private findExactMatch(
    query: string,
    type: 'success' | 'failure',
  ): Pattern | undefined {
    return this.patterns.find(
      (p) =>
        p.query.toLowerCase() === query.toLowerCase() && p.type === type,
    );
  }

  /**
   * Remove oldest patterns when limit is exceeded
   */
  private trimOldest(): void {
    // Sort by timestamp (oldest first)
    this.patterns.sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );

    // Remove oldest patterns, but keep high-frequency ones
    const toRemove = this.patterns.length - this.maxPatterns;
    const removed: Pattern[] = [];

    for (let i = 0; i < toRemove && i < this.patterns.length; i++) {
      const pattern = this.patterns[i];
      // Only remove if frequency is low
      if ((pattern.frequency || 1) <= 2) {
        removed.push(pattern);
      }
    }

    // Remove the identified patterns
    this.patterns = this.patterns.filter((p) => !removed.includes(p));
  }

  /**
   * Clear all patterns (useful for testing)
   */
  clear(): void {
    this.patterns = [];
  }

  /**
   * Get total number of patterns stored
   */
  size(): number {
    return this.patterns.length;
  }

  /**
   * Get statistics about stored patterns
   */
  getStats(): {
    total: number;
    successes: number;
    failures: number;
    mostFrequent?: Pattern;
  } {
    const successes = this.patterns.filter((p) => p.type === 'success')
      .length;
    const failures = this.patterns.filter((p) => p.type === 'failure')
      .length;

    const mostFrequent = this.patterns.reduce(
      (max, p) =>
        (p.frequency || 1) > (max.frequency || 1) ? p : max,
      this.patterns[0],
    );

    return {
      total: this.patterns.length,
      successes,
      failures,
      mostFrequent,
    };
  }
}
