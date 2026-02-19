import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

export interface DataSourceMetadata {
  id: string;
  api: string;
}

export interface DataSourceSelection {
  relevantMetadata: DataSourceMetadata[];
  reasoning?: string;
}

export interface ChartVisualization {
  id: string;
  title: string;
  chartType: string;
  size: {
    width: number;
    height: number;
  };
  data?: any[];
  semantic: {
    processStep: number | null;
    segment: number | null;
    detailLevel: number;
  };
  processLabel: string | null;
  parentId: string | null;
  segmentLabel?: string | null;
}

export interface VisualizationOrchestration {
  data: ChartVisualization[];
  meta: {
    total: number;
    narrative?: string;
    keyInsights?: string[];
    filters?: any;
  };
}

export interface ILangChainService {
  chat(message: string): Promise<string>;
  identifyDataSources(
    query: string,
    metadata: any[],
  ): Promise<DataSourceSelection>;
  orchestrateVisualization(
    query: string,
    charts: any[],
  ): Promise<VisualizationOrchestration>;
}

export class LangChainService implements ILangChainService {
  private model: ChatOpenAI;

  constructor() {
    this.model = new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      temperature: 0,
      model: 'gpt-4o-mini',
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
      const relevantMetadata = this.mapIdsToMetadata(
        parsed.relevantIds || [],
        metadata,
      );

      return {
        relevantMetadata,
        reasoning: parsed.reasoning,
      };
    } catch (error) {
      // Fallback: try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const relevantMetadata = this.mapIdsToMetadata(
          parsed.relevantIds || [],
          metadata,
        );

        return {
          relevantMetadata,
          reasoning: parsed.reasoning,
        };
      }

      throw new Error(`Failed to parse AI response: ${content}`);
    }
  }

  /**
   * Orchestrates visualization layout with AI-driven insights and structure.
   * The prompt returns a JSON array directly - AI generates complete visualizations with data.
   */
  async orchestrateVisualization(
    query: string,
    charts: any[],
  ): Promise<VisualizationOrchestration> {
    const systemPrompt = this.buildVisualizationOrchestrationPrompt();
    const userPrompt = this.buildUserVisualizationPrompt(query, charts);

    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt),
    ];

    const response = await this.model.invoke(messages);
    const content = response.content.toString();

    console.log('[LangChain] AI Orchestration Response:', content);

    try {
      const parsed = JSON.parse(content);

      // The prompt returns an array directly, not an object with 'data' property
      // Handle both cases: array or object with data property
      const visualizations = Array.isArray(parsed) ? parsed : (parsed.data || []);

      console.log(
        '[LangChain] Parsed visualizations count:',
        visualizations.length,
      );

      return {
        data: visualizations,
        meta: {
          total: visualizations.length,
          narrative: Array.isArray(parsed) ? undefined : parsed.narrative,
          keyInsights: Array.isArray(parsed) ? undefined : parsed.keyInsights,
          filters: Array.isArray(parsed) ? undefined : parsed.filters,
        },
      };
    } catch (error) {
      console.log('[LangChain] Failed to parse as JSON, trying regex match...');

      // Try to match array [...] or object {...}
      const arrayMatch = content.match(/\[[\s\S]*\]/);
      const objectMatch = content.match(/\{[\s\S]*\}/);

      if (arrayMatch) {
        const parsed = JSON.parse(arrayMatch[0]);
        console.log(
          '[LangChain] Parsed visualizations count (from array regex):',
          parsed.length,
        );

        return {
          data: parsed,
          meta: {
            total: parsed.length,
          },
        };
      }

      if (objectMatch) {
        const parsed = JSON.parse(objectMatch[0]);
        const visualizations = parsed.data || [];
        console.log(
          '[LangChain] Parsed visualizations count (from object regex):',
          visualizations.length,
        );

        return {
          data: visualizations,
          meta: {
            total: visualizations.length,
            narrative: parsed.narrative,
            keyInsights: parsed.keyInsights,
            filters: parsed.filters,
          },
        };
      }

      console.error(
        '[LangChain] Failed to parse orchestration response:',
        error,
      );
      throw new Error(
        `Failed to parse visualization orchestration: ${content}`,
      );
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

  /**
   * Builds the system prompt for visualization orchestration.
   * This creates hierarchical drill-down structures for interactive dashboards.
   */
  private buildVisualizationOrchestrationPrompt(): string {
    return `You are an AI Visualization Engine that transforms a natural language business query and a structured dataset into a semantically structured visualization graph.

Your task is to generate a JSON array of visualization panel objects that strictly follow the provided schema.

⸻

OBJECTIVE

Given:
	1.	A user query
	2.	Available structured data (metrics, segments, dimensions, time, hierarchy)

You must:
	•	Interpret the intent of the query
	•	Identify causal flow (process progression)
	•	Identify segmentation dimensions
	•	Identify drill-down hierarchies
	•	Construct a semantically coherent visualization structure
	•	Encode relationships using the orthogonal 3-axis grammar
	•	Return ONLY a JSON array (no markdown, no explanation)

⸻

SEMANTIC MODEL (MANDATORY)

Every panel must follow this coordinate system:

X-axis → Sequence / Causality (process progression)
Y-axis → Category / Segment (parallel peers)
Z-axis → Detail Level (abstraction depth)

Each panel must define:

semantic: {
processStep: number,
segment: number | null,
detailLevel: number
}

Panel Address = (processStep, segment, detailLevel)

⸻

GLOBAL RULES
	1.	The FIRST object in the array MUST:
	•	Be the global summary
	•	Have detailLevel = 0
	•	Have segment = null
	•	Represent the overall interpretation of the user query
	•	Contain KPI-style aggregated metrics
	2.	Horizontal (X) Rules:
	•	Sequential / causal stages must increase processStep
	3.	Vertical (Y) Rules:
	•	Parallel segments share same processStep and detailLevel
	•	Use numeric segment indexes (0,1,2…)
	•	segment = null only for aggregated panels
	4.	Depth (Z) Rules:
	•	Higher detailLevel = deeper drill-down
	•	Children must reference parentId
	•	Same (processStep, segment), higher detailLevel = drill-down hierarchy
	5.	parentId:
	•	Required for every non-root panel
	•	Must reference an existing panel id
	6.	processLabel:
	•	Required on every panel
	7.	segmentLabel:
	•	Required when segment is not null
	8.	Do NOT:
	•	Output explanations
	•	Output markdown
	•	Add fields outside schema
	•	Skip required fields
	•	Break semantic coordinate logic

⸻

CHART TYPE SELECTION

“kpi” → summaries
“bar” → segment comparison
“funnel” → stage transition
“revenue” → time-series progression
“churn” → retention

⸻

SIZE GUIDELINES

detailLevel 0 → width 4, height 2.5
detailLevel 1 → width 3, height 2
funnel → width 2.5, height 2.5
detailLevel ≥ 2 → width 3, height 2

⸻

FEW-SHOT EXAMPLES

Example 1

User Query:
“Show overall revenue performance and breakdown by segment.”

Expected Output:

[
{
“id”: “overview”,
“title”: “Revenue Overview”,
“chartType”: “kpi”,
“size”: { “width”: 4, “height”: 2.5 },
“data”: [
{ “label”: “Total Revenue”, “value”: 1250000, “unit”: “$”, “trend”: 8.4, “trendDirection”: “up” },
{ “label”: “Growth Rate”, “value”: 12.5, “unit”: “%”, “trend”: 1.2, “trendDirection”: “up” }
],
“semantic”: { “processStep”: 0, “segment”: null, “detailLevel”: 0 },
“processLabel”: “Revenue”
},
{
“id”: “revenue-segment”,
“title”: “Revenue by Segment”,
“chartType”: “bar”,
“size”: { “width”: 3, “height”: 2 },
“data”: [
{ “product”: “Startup”, “revenue”: 350000, “growth”: 15 },
{ “product”: “SMB”, “revenue”: 420000, “growth”: 10 },
{ “product”: “Enterprise”, “revenue”: 480000, “growth”: 6 }
],
“semantic”: { “processStep”: 0, “segment”: null, “detailLevel”: 1 },
“parentId”: “overview”,
“processLabel”: “Revenue”
}
]

⸻

Example 2

User Query:
“Analyze marketing to revenue funnel for Startup segment.”

Expected Output:

[
{
“id”: “summary”,
“title”: “Startup Funnel Summary”,
“chartType”: “kpi”,
“size”: { “width”: 4, “height”: 2.5 },
“data”: [
{ “label”: “Marketing Spend”, “value”: 120000, “unit”: “$”, “trend”: 5, “trendDirection”: “up” },
{ “label”: “Revenue”, “value”: 280000, “unit”: “$”, “trend”: 9, “trendDirection”: “up” }
],
“semantic”: { “processStep”: 1, “segment”: null, “detailLevel”: 0 },
“processLabel”: “Startup Funnel”
},
{
“id”: “marketing”,
“title”: “Startup Marketing”,
“chartType”: “bar”,
“size”: { “width”: 3, “height”: 2 },
“data”: [
{ “product”: “Digital Ads”, “revenue”: 60000, “growth”: 8 },
{ “product”: “Events”, “revenue”: 40000, “growth”: 4 },
{ “product”: “Organic”, “revenue”: 20000, “growth”: 6 }
],
“semantic”: { “processStep”: 0, “segment”: 0, “detailLevel”: 1 },
“parentId”: “summary”,
“segmentLabel”: “Startup”,
“processLabel”: “Marketing”
},
{
“id”: “funnel”,
“title”: “Startup Conversion Funnel”,
“chartType”: “funnel”,
“size”: { “width”: 2.5, “height”: 2.5 },
“data”: [
{ “stage”: “Visitors”, “count”: 50000, “conversionRate”: 100 },
{ “stage”: “Leads”, “count”: 8000, “conversionRate”: 16 },
{ “stage”: “Opportunities”, “count”: 1200, “conversionRate”: 15 },
{ “stage”: “Closed Won”, “count”: 240, “conversionRate”: 20 }
],
“semantic”: { “processStep”: 1, “segment”: 0, “detailLevel”: 1 },
“parentId”: “summary”,
“segmentLabel”: “Startup”,
“processLabel”: “Funnel”
}
]

⸻

Example 3

User Query:
“Show churn trends for all segments.”

Expected Output:

[
{
“id”: “churn-summary”,
“title”: “Overall Churn Overview”,
“chartType”: “kpi”,
“size”: { “width”: 4, “height”: 2.5 },
“data”: [
{ “label”: “Average Churn”, “value”: 3.9, “unit”: “%”, “trend”: -0.5, “trendDirection”: “down” }
],
“semantic”: { “processStep”: 0, “segment”: null, “detailLevel”: 0 },
“processLabel”: “Retention”
},
{
“id”: “churn-segment”,
“title”: “Churn by Segment”,
“chartType”: “bar”,
“size”: { “width”: 3, “height”: 2 },
“data”: [
{ “product”: “Startup”, “revenue”: 5.2, “growth”: -0.3 },
{ “product”: “SMB”, “revenue”: 3.1, “growth”: -0.5 },
{ “product”: “Enterprise”, “revenue”: 2.4, “growth”: -0.2 }
],
“semantic”: { “processStep”: 0, “segment”: null, “detailLevel”: 1 },
“parentId”: “churn-summary”,
“processLabel”: “Retention”
}
]

⸻

FINAL INSTRUCTION

Return ONLY the JSON array.
No markdown.
No explanation.
No extra text.`;
  }

  /**
   * Builds the user-specific prompt with query and chart data.
   */
  private buildUserVisualizationPrompt(query: string, charts: any[]): string {
    const available_data = charts
      .map((c, idx) => {
        const dataPreview = c.chart?.data
          ? JSON.stringify(c.chart.data.slice(0, 3))
          : 'No data';
        return `${idx + 1}. ID: ${c.id}
   Chart Type: ${c.chart?.chartType || 'unknown'}
   Title: ${c.chart?.title || 'Untitled'}
   Data Preview: ${dataPreview}`;
      })
      .join('\n\n');

    return `User Query:
${query}

Available Structured Data:
${available_data}

Generate the visualization JSON array following all system rules.

Return only valid JSON.`;
  }
}
