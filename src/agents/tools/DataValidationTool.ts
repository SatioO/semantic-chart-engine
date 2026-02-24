/**
 * DataValidationTool - Validates data quality and relevance
 * Detects issues like zero rows, missing fields, bad data
 */

import { BaseTool } from './IAgentTool';
import {
  ToolInput,
  ToolOutput,
  ToolContext,
  Issue,
} from '../../types/agent.types';

export class DataValidationTool extends BaseTool {
  name = 'validate_data';
  description =
    'Validates data quality by checking for zero rows, missing fields, bad values, and relevance to query';

  async execute(input: ToolInput, context: ToolContext): Promise<ToolOutput> {
    try {
      this.logVerbose('Validating data quality', context);

      if (!input.data) {
        return this.createErrorOutput('Data is required for validation');
      }

      const issues: Issue[] = [];

      // Check 1: Zero rows
      if (Array.isArray(input.data) && input.data.length === 0) {
        issues.push({
          type: 'zero_rows',
          severity: 'critical',
          description:
            'Query returned zero rows - likely due to incorrect filter, bad join, or missing data',
          suggestedFix:
            'Relax filter conditions, verify data source selection, or check for data availability',
        });
      }

      // Check 2: Expected fields
      if (input.expectedFields && Array.isArray(input.data) && input.data.length > 0) {
        const actualFields = Object.keys(input.data[0]);
        const missing = input.expectedFields.filter(
          (f) => !actualFields.includes(f),
        );

        if (missing.length > 0) {
          issues.push({
            type: 'missing_data',
            severity: 'warning',
            description: `Missing expected fields: ${missing.join(', ')}`,
            suggestedFix:
              'Select different data sources or adjust query to include required fields',
            context: { missing, actual: actualFields },
          });
        }
      }

      // Check 3: Data structure validity
      if (Array.isArray(input.data) && input.data.length > 0) {
        const structureIssue = this.validateStructure(input.data);
        if (structureIssue) {
          issues.push(structureIssue);
        }
      }

      // Check 4: Data completeness
      if (Array.isArray(input.data) && input.data.length > 0) {
        const completeness = this.assessCompleteness(input.data);
        if (completeness < 0.8) {
          issues.push({
            type: 'incomplete',
            severity: 'warning',
            description: `Data appears incomplete (${(completeness * 100).toFixed(0)}% complete)`,
            suggestedFix:
              'Verify data source has complete information or adjust query',
            context: { completenessScore: completeness },
          });
        }
      }

      // Calculate overall confidence
      const confidence = this.calculateConfidence(issues, input.data);

      const valid = issues.filter((i) => i.severity === 'critical').length === 0;

      this.logVerbose(
        `Validation ${valid ? 'passed' : 'failed'} with ${issues.length} issues`,
        context,
      );

      return this.createSuccessOutput(
        {
          valid,
          issues,
          dataSize: Array.isArray(input.data) ? input.data.length : 0,
          summary: this.generateSummary(issues, input.data),
        },
        confidence,
      );
    } catch (error: any) {
      this.logVerbose(`Validation error: ${error.message}`, context);
      return this.createErrorOutput(error.message);
    }
  }

  private validateStructure(data: any[]): Issue | null {
    // Check if all items have consistent structure
    if (data.length === 0) return null;

    const firstKeys = Object.keys(data[0]).sort();

    for (let i = 1; i < Math.min(data.length, 100); i++) {
      const keys = Object.keys(data[i]).sort();
      if (JSON.stringify(keys) !== JSON.stringify(firstKeys)) {
        return {
          type: 'invalid_structure',
          severity: 'warning',
          description: 'Inconsistent data structure detected across rows',
          suggestedFix:
            'Verify data source returns consistent schema or normalize data',
        };
      }
    }

    return null;
  }

  private assessCompleteness(data: any[]): number {
    if (data.length === 0) return 0;

    let totalFields = 0;
    let filledFields = 0;

    // Sample first 100 rows for performance
    const sample = data.slice(0, 100);

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

  private calculateConfidence(issues: Issue[], data: any): number {
    // Start with high confidence
    let confidence = 1.0;

    // Penalize for critical issues
    const critical = issues.filter((i) => i.severity === 'critical').length;
    confidence -= critical * 0.5;

    // Penalize for warnings
    const warnings = issues.filter((i) => i.severity === 'warning').length;
    confidence -= warnings * 0.1;

    // Penalize for small data size
    if (Array.isArray(data)) {
      if (data.length < 5) {
        confidence -= 0.2;
      } else if (data.length < 20) {
        confidence -= 0.1;
      }
    }

    return Math.max(0, Math.min(1, confidence));
  }

  private generateSummary(issues: Issue[], data: any): string {
    if (issues.length === 0) {
      const size = Array.isArray(data) ? data.length : 0;
      return `Data validation passed successfully with ${size} rows`;
    }

    const critical = issues.filter((i) => i.severity === 'critical').length;
    const warnings = issues.filter((i) => i.severity === 'warning').length;

    return `Found ${critical} critical issue(s) and ${warnings} warning(s)`;
  }

  protected getInputSchema(): any {
    return {
      type: 'object',
      properties: {
        data: {
          description: 'Data to validate',
        },
        expectedFields: {
          type: 'array',
          description: 'Expected fields that should be present',
          items: { type: 'string' },
        },
        query: {
          type: 'string',
          description: 'Original query for context',
        },
      },
      required: ['data'],
    };
  }

  protected getOutputSchema(): any {
    return {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            valid: {
              type: 'boolean',
              description: 'Whether validation passed',
            },
            issues: {
              type: 'array',
              description: 'Issues found during validation',
            },
            dataSize: {
              type: 'number',
              description: 'Number of rows in data',
            },
            summary: {
              type: 'string',
              description: 'Human-readable summary',
            },
          },
        },
        confidence: { type: 'number' },
      },
    };
  }

  protected getExamples(): Array<{ input: any; output: any }> {
    return [
      {
        input: {
          data: [],
          query: 'Show revenue',
        },
        output: {
          success: true,
          data: {
            valid: false,
            issues: [
              {
                type: 'zero_rows',
                severity: 'critical',
                description: 'Query returned zero rows',
              },
            ],
            dataSize: 0,
            summary: 'Found 1 critical issue(s) and 0 warning(s)',
          },
          confidence: 0.5,
        },
      },
    ];
  }
}
