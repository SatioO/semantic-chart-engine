/**
 * DataQualityEvaluator - Evaluates data quality
 * Checks for zero rows, missing data, invalid structure
 */

import { BaseEvaluator } from './IEvaluator';
import { EvaluationResult, Issue } from '../../types/agent.types';
import { AgentState } from '../AgentState';

export class DataQualityEvaluator extends BaseEvaluator {
  name = 'data_quality';
  description = 'Evaluates data quality including completeness, structure, and size';

  async evaluate(result: any, state: AgentState): Promise<EvaluationResult> {
    this.logVerbose('Evaluating data quality', state);

    const issues: Issue[] = [];
    let score = 1.0;

    // Extract data from result
    const data = result?.data || result;

    // Check 1: Data exists and not empty
    if (!data) {
      issues.push({
        type: 'missing_data',
        severity: 'critical',
        description: 'No data returned from execution',
      });
      score -= 0.5;
    } else if (Array.isArray(data) && data.length === 0) {
      issues.push({
        type: 'zero_rows',
        severity: 'critical',
        description: 'Query returned zero rows',
        suggestedFix: 'Check filters, joins, or data availability',
      });
      score -= 0.5;
    }

    // Check 2: Data structure
    if (Array.isArray(data) && data.length > 0) {
      const structureScore = this.evaluateStructure(data, issues);
      score *= structureScore;
    }

    // Check 3: Data completeness
    if (Array.isArray(data) && data.length > 0) {
      const completeness = this.calculateCompleteness(data);
      if (completeness < 0.8) {
        issues.push({
          type: 'incomplete',
          severity: 'warning',
          description: `Data is ${(completeness * 100).toFixed(0)}% complete`,
        });
        score -= 0.1;
      }
    }

    const passed = issues.filter((i) => i.severity === 'critical').length === 0;

    this.logVerbose(
      `Data quality ${passed ? 'passed' : 'failed'} with score ${score.toFixed(2)}`,
      state,
    );

    return this.createResult(score, passed, issues);
  }

  private evaluateStructure(data: any[], issues: Issue[]): number {
    if (data.length === 0) return 1.0;

    // Check consistency
    const firstKeys = Object.keys(data[0]).sort();
    let inconsistentCount = 0;

    for (let i = 1; i < Math.min(data.length, 50); i++) {
      const keys = Object.keys(data[i]).sort();
      if (JSON.stringify(keys) !== JSON.stringify(firstKeys)) {
        inconsistentCount++;
      }
    }

    if (inconsistentCount > 0) {
      issues.push({
        type: 'invalid_structure',
        severity: 'warning',
        description: `${inconsistentCount} rows have inconsistent structure`,
      });
      return 0.8;
    }

    return 1.0;
  }

  private calculateCompleteness(data: any[]): number {
    if (data.length === 0) return 0;

    let totalFields = 0;
    let filledFields = 0;

    const sample = data.slice(0, 50);

    for (const row of sample) {
      const keys = Object.keys(row);
      totalFields += keys.length;

      for (const key of keys) {
        const value = row[key];
        if (
          value !== null &&
          value !== undefined &&
          value !== '' &&
          !Number.isNaN(value)
        ) {
          filledFields++;
        }
      }
    }

    return totalFields > 0 ? filledFields / totalFields : 0;
  }
}
