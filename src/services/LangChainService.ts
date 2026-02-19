import { ChatGroq } from '@langchain/groq';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

export interface DataSourceMetadata {
  id: string;
  api: string;
}

export interface DataSourceSelection {
  relevantIds: DataSourceMetadata[];
  reasoning?: string;
}

export interface ILangChainService {
  chat(message: string): Promise<string>;
  identifyDataSources(
    query: string,
    metadata: any[],
  ): Promise<DataSourceSelection>;
}

export class LangChainService implements ILangChainService {
  private model: ChatGroq;

  constructor() {
    this.model = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      temperature: 0,
      model: 'llama-3.1-8b-instant',
    });
  }

  async chat(message: string): Promise<string> {
    const response = await this.model.invoke([new HumanMessage(message)]);
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    return response.content.toString();
  }

  /**
   * Analyzes a user query and identifies relevant data sources from metadata.
   * Returns an array of metadata objects that are most relevant to the query.
   */
  async identifyDataSources(
    query: string,
    metadata: DataSourceMetadata[],
  ): Promise<DataSourceSelection> {
    const systemPrompt = this.buildDataSourceSelectionPrompt(metadata);

    const messages = [new SystemMessage(systemPrompt), new HumanMessage(query)];

    const response = await this.model.invoke(messages);
    const content = response.content.toString();

    try {
      // Parse the JSON response
      const parsed = JSON.parse(content);

      // Convert the response to use full metadata objects
      const relevantIds = this.mapIdsToMetadata(
        parsed.relevantIds || [],
        metadata,
      );

      return {
        relevantIds,
        reasoning: parsed.reasoning,
      };
    } catch (error) {
      // Fallback: try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const relevantIds = this.mapIdsToMetadata(
          parsed.relevantIds || [],
          metadata,
        );

        return {
          relevantIds,
          reasoning: parsed.reasoning,
        };
      }

      throw new Error(`Failed to parse AI response: ${content}`);
    }
  }

  /**
   * Maps string IDs or metadata objects to full metadata objects.
   */
  private mapIdsToMetadata(
    ids: (string | DataSourceMetadata)[],
    metadata: DataSourceMetadata[],
  ): DataSourceMetadata[] {
    return ids
      .map((item) => {
        // If it's already an object with id and api, return it
        if (typeof item === 'object' && 'id' in item && 'api' in item) {
          return item;
        }

        // If it's a string, find the matching metadata object
        const id = typeof item === 'string' ? item : (item as any).id;
        const found = metadata.find((m) => m.id === id);

        if (!found) {
          console.warn(`[LangChain] Data source "${id}" not found in metadata`);
          return { id, api: '' };
        }

        return found;
      })
      .filter((m) => m.api !== ''); // Filter out items not found in metadata
  }

  /**
   * Builds the system prompt for data source identification.
   * This prompt instructs the AI to analyze user queries and select relevant data sources.
   */
  private buildDataSourceSelectionPrompt(metadata: any[]): string {
    const metadataList = metadata
      .map((m) => `  - ${m.id}: ${m.api}`)
      .join('\n');

    return `You are a data source identification assistant for a business analytics platform. Your task is to analyze user queries and identify which data sources are most relevant to answer their question.

# Available Data Sources

The following data sources are available, organized by business metrics and customer segments:

${metadataList}

# Data Source Categories

## Business Metrics (Process Steps):
- **dashboard**: High-level overview across all metrics
- **marketing**: Marketing campaigns, spend, CAC (Customer Acquisition Cost)
- **leads**: Lead generation, sources, and quality
- **pipeline**: Sales pipeline, stages, conversion rates
- **revenue**: MRR, ARR, revenue by account
- **retention**: Customer churn, retention rates

## Customer Segments:
- **startup**: Startup customers (small, early-stage companies)
- **smb**: Small and Medium Business customers
- **enterprise**: Enterprise customers (large organizations)
- **(no segment suffix)**: Cross-segment overview/aggregate data

## Detail Breakdowns:
- **-source**: Breakdown by lead source (e.g., leads-startup-source)
- **-stage**: Breakdown by pipeline stage (e.g., pipeline-smb-stage)
- **-account**: Breakdown by account (e.g., revenue-enterprise-account)

# Your Task

Analyze the user's query and identify which data sources would be most relevant. Consider:

1. **Business Context**: What metric(s) are they asking about? (marketing, leads, pipeline, revenue, retention)
2. **Segment Focus**: Are they asking about a specific customer segment? (startup, smb, enterprise, or all)
3. **Detail Level**: Do they want high-level overview or detailed breakdown?
4. **Comparisons**: Are they comparing across segments or looking at a single segment?

# Response Format

You MUST respond with valid JSON only, in this exact format:

{
  "relevantIds": [
    {
      "id": "data-source-id",
      "api": "/api/endpoint"
    }
  ],
  "reasoning": "Brief explanation of why these data sources were selected"
}

# Guidelines

- **Be selective**: Only include data sources that directly answer the query
- **Prioritize relevance**: Put the most relevant items first in the array
- **Include related sources**: If comparing segments, include all relevant segment variations
- **Default to overview**: If the query is vague, prefer high-level sources like "dashboard"
- **No explanations outside JSON**: Your entire response must be valid JSON
- **Return full objects**: Each item in relevantIds must include both "id" and "api" fields

# Examples

Query: "Show me marketing performance for startups"
Response:
{
  "relevantIds": [
    {
      "id": "marketing-startup",
      "api": "/platforms/3danalytics/charts/marketing-startup"
    }
  ],
  "reasoning": "User specifically asked for marketing metrics filtered to startup segment"
}

Query: "How are we doing on revenue across all customer types?"
Response:
{
  "relevantIds": [
    {
      "id": "revenue",
      "api": "/platforms/3danalytics/charts/revenue"
    },
    {
      "id": "revenue-startup",
      "api": "/platforms/3danalytics/charts/revenue-startup"
    },
    {
      "id": "revenue-smb",
      "api": "/platforms/3danalytics/charts/revenue-smb"
    },
    {
      "id": "revenue-enterprise",
      "api": "/platforms/3danalytics/charts/revenue-enterprise"
    }
  ],
  "reasoning": "User wants revenue comparison across all segments, so including the overview and all segment-specific revenue sources"
}

Query: "What's our lead conversion in the enterprise segment?"
Response:
{
  "relevantIds": [
    {
      "id": "leads-enterprise",
      "api": "/platforms/3danalytics/charts/leads-enterprise"
    },
    {
      "id": "pipeline-enterprise",
      "api": "/platforms/3danalytics/charts/pipeline-enterprise"
    }
  ],
  "reasoning": "Lead conversion requires both lead data and pipeline data to calculate conversion rates for enterprise segment"
}

Query: "Give me an overview of the business"
Response:
{
  "relevantIds": [
    {
      "id": "dashboard",
      "api": "/platforms/3danalytics/charts/dashboard"
    }
  ],
  "reasoning": "High-level business overview is best served by the dashboard data source"
}

Query: "Where are our SMB leads coming from?"
Response:
{
  "relevantIds": [
    {
      "id": "leads-smb-source",
      "api": "/platforms/3danalytics/charts/leads-smb-source"
    }
  ],
  "reasoning": "User wants lead source breakdown specifically for SMB segment"
}

Now, analyze the user's query and respond with the relevant data sources in JSON format.`;
  }
}
