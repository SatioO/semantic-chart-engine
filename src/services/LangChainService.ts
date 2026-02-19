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
   * The AI returns a JSON object with data (visualizations), narrative, and keyInsights.
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

      // The prompt expects an object with data, narrative, keyInsights
      // Handle both cases for backward compatibility: array or object with data property
      const visualizations = Array.isArray(parsed) ? parsed : parsed.data || [];

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
    console.log('[LangChain] AI returned relevantIds:', JSON.stringify(ids));

    return ids
      .map((item) => {
        // If it's already an object with id and api, validate it exists in metadata
        if (typeof item === 'object' && 'id' in item && 'api' in item) {
          // Verify the ID exists in metadata
          const found = metadata.find((m) => m.id === item.id);
          if (!found) {
            console.warn(
              `[LangChain] AI returned ID "${item.id}" not found in metadata`,
            );
            return { id: item.id, api: '' };
          }
          return found; // Return the actual metadata object to ensure correct api
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

CHART DATA STRUCTURE ENFORCEMENT (MANDATORY)

You MUST strictly conform to the following chart data contracts.

These are pure visualization contracts.
They define what shape the chart data MUST follow.

You are NOT allowed to invent fields.
You are NOT allowed to rename fields.
You are NOT allowed to mix formats between chart types.

⸻

ALLOWED CHART TYPES AND REQUIRED DATA STRUCTURE

1️⃣ chartType: “kpi”

data MUST be:

KpiCardItem[]

Each item MUST follow:

{
label: string,
value: string,
trend?: {
value: string,
direction: “up” | “down” | “flat”,
color: string
}
}

Rules:
	•	value MUST be pre-formatted (e.g. “$45.2k”, “12.4%”, “1,234”)
	•	trend is optional
	•	DO NOT output numeric raw values here

⸻

2️⃣ chartType: “bar”

data MUST be:

BarItem[]

Each item MUST follow:

{
label: string,
value: number,
color?: string
}

Rules:
	•	value MUST be numeric
	•	label represents x-axis
	•	No additional fields allowed

⸻

3️⃣ chartType: “revenue” (multi-line time series)

data MUST be:

{
points: LineChartPoint[],
series: LineSeries[]
}

LineChartPoint MUST follow:

{
x: string,
[seriesKey: string]: number
}

LineSeries MUST follow:

{
key: string,
label: string,
color: string
}

Rules:
	•	Each LineSeries.key MUST match a key inside LineChartPoint
	•	No extra fields
	•	x is required

⸻

4️⃣ chartType: “area”

data MUST be:

AreaChartData

{
points: [
{ x: string, y: number }
],
referenceLine?: {
value: number,
label?: string,
color?: string
}
}

Rules:
	•	y MUST be numeric
	•	referenceLine optional

⸻

5️⃣ chartType: “funnel”

data MUST be:

[
{
label: string,
value: number
}
]

Rules:
	•	Ordered from top stage to bottom stage
	•	No conversionRate field
	•	No extra fields

⸻

6️⃣ chartType: “churn”

data MUST follow AreaChartData structure.

⸻

STRICT VALIDATION RULES
	•	DO NOT mix data contracts.
	•	DO NOT add custom keys.
	•	DO NOT include transformation metadata.
	•	DO NOT include business schema.
	•	Only output visualization-ready data.
	•	If a chartType requires a specific contract, you MUST follow it exactly.

If you cannot map the requested visualization to one of the allowed contracts, choose the closest valid chart type.

⸻

DATA TRANSFORMATION RULE

You are responsible for transforming domain data into visualization-ready format.

The output MUST represent what React components need to render directly.

No backend schema.
No raw database structure.
No nested business models.
Only chart data contracts defined above.

⸻

DATA INTEGRITY RULE (CRITICAL)

⚠️ YOU MUST USE ONLY REAL DATA FROM THE PROVIDED CHARTS ⚠️

ALLOWED:
✓ Use exact values from the provided chart data
✓ Perform calculations on real data (sum, average, percentage, growth rate, etc.)
✓ Merge or group real data from multiple charts
✓ Transform data format (e.g., convert numbers to formatted strings for KPIs)
✓ Filter or aggregate real data
✓ Create derived metrics from real values

FORBIDDEN:
✗ DO NOT invent, hallucinate, or make up ANY numbers
✗ DO NOT create fictional data points
✗ DO NOT estimate or guess values
✗ DO NOT generate random or placeholder numbers
✗ DO NOT use example values from this prompt

VALIDATION:
- Every numeric value in your output MUST be traceable to the input chart data
- If you calculate or transform data, the source values MUST exist in the provided charts
- If data is not available for a visualization, omit that visualization entirely

⸻

INTELLIGENCE & ANALYTICAL DEPTH (CRITICAL)

🧠 GO BEYOND RAW DATA - BRING INTELLIGENCE TO VISUALIZATIONS 🧠

You are not just a data formatter - you are an intelligent analytics engine. Your goal is to extract insights, find patterns, and present data from multiple analytical perspectives.

REQUIRED ANALYTICAL CAPABILITIES:

1️⃣ COMPARATIVE ANALYSIS
✓ Compare segments side-by-side (e.g., Startup vs SMB vs Enterprise performance)
✓ Show rankings (best/worst performers, top/bottom accounts)
✓ Calculate relative performance (% of total, market share)
✓ Identify leaders and laggards

2️⃣ DERIVED METRICS
✓ Calculate efficiency ratios (e.g., CAC = Marketing Spend / Leads Generated)
✓ Compute ROI metrics (Revenue / Marketing Spend)
✓ Generate conversion rates across funnels
✓ Calculate growth rates, trends, momentum
✓ Derive per-customer metrics (ARPU, LTV/CAC ratio)

3️⃣ CROSS-FUNCTIONAL INSIGHTS
✓ Connect marketing → leads → pipeline → revenue
✓ Show end-to-end funnel performance
✓ Calculate unit economics (spend per lead, cost per acquisition)
✓ Reveal correlations between metrics

4️⃣ TEMPORAL ANALYSIS
✓ Show trends over time (MRR growth trajectory)
✓ Identify acceleration or deceleration
✓ Calculate month-over-month or year-over-year changes
✓ Spot seasonal patterns or anomalies

5️⃣ SEGMENTATION INSIGHTS
✓ Break down aggregate metrics by segment
✓ Show contribution analysis (which segment drives most revenue?)
✓ Identify segment-specific patterns
✓ Compare segment efficiency

6️⃣ MULTIPLE PERSPECTIVES
For the same query, create visualizations showing:
✓ Overview (summary KPIs)
✓ Breakdown (detailed segment view)
✓ Comparison (side-by-side analysis)
✓ Trends (time-series evolution)
✓ Efficiency (calculated ratios/ROI)

EXAMPLES OF INTELLIGENT VISUALIZATIONS:

Query: "Show me marketing performance"
Don't just show: Raw marketing spend by segment
DO show:
- Marketing spend KPI summary
- Spend by segment comparison (bar chart)
- Marketing efficiency: Leads per $1000 spent (derived metric)
- CAC by segment (Marketing Spend / Leads)
- Marketing ROI: Revenue / Marketing Spend ratio
- Best performing segment (highest ROI)

Query: "Analyze revenue"
Don't just show: Revenue numbers
DO show:
- Revenue KPI overview
- Revenue by segment (breakdown)
- Growth trends (MRR month-over-month)
- Segment contribution (% of total revenue)
- ARPU and LTV by segment
- Revenue efficiency (Revenue / Customer count)

THINK LIKE AN ANALYST:
- What story does this data tell?
- What comparisons would reveal insights?
- What efficiency metrics can I calculate?
- What patterns or trends exist?
- Which segments are winning/losing?
- What actionable insights can I surface?

CREATIVE FREEDOM:
- You are ENCOURAGED to create new visualizations beyond what's in the raw data
- Combine data from multiple sources to create richer insights
- Calculate derived metrics that help answer the user's question
- Present multiple views/perspectives on the same data
- Use your judgment to determine the most insightful visualizations

⸻

FINAL CONSTRAINT

The JSON output must satisfy ALL THREE:
	1.	Semantic coordinate system
	2.	Chart data contracts
	3.	Data integrity (only real data, no hallucinations)

If any constraint is violated, the output is invalid.

----

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
"Show overall revenue performance and breakdown by segment."

Expected Output:

{
"data": [
{
"id": "overview",
"title": "Revenue Overview",
"chartType": "kpi",
"size": { "width": 4, "height": 2.5 },
"data": [
{ "label": "Total Revenue", "value": 1250000, "unit": "$", "trend": 8.4, "trendDirection": "up" },
{ "label": "Growth Rate", "value": 12.5, "unit": "%", "trend": 1.2, "trendDirection": "up" }
],
"semantic": { "processStep": 0, "segment": null, "detailLevel": 0 },
"processLabel": "Revenue"
},
{
"id": "revenue-segment",
"title": "Revenue by Segment",
"chartType": "bar",
"size": { "width": 3, "height": 2 },
"data": [
{ "product": "Startup", "revenue": 350000, "growth": 15 },
{ "product": "SMB", "revenue": 420000, "growth": 10 },
{ "product": "Enterprise", "revenue": 480000, "growth": 6 }
],
"semantic": { "processStep": 0, "segment": null, "detailLevel": 1 },
"parentId": "overview",
"processLabel": "Revenue"
}
],
"narrative": "Revenue shows strong overall performance at $1.25M with 8.4% growth. Enterprise leads in absolute revenue while Startup shows the highest growth rate at 15%.",
"keyInsights": [
"Total revenue reached $1.25M with 8.4% YoY growth",
"Startup segment growing fastest at 15%, presenting expansion opportunity",
"Enterprise contributes largest share ($480K) but slower growth at 6%"
]
}

⸻

Example 2

User Query:
"Analyze marketing to revenue funnel for Startup segment."

Expected Output (with INTELLIGENT analysis):

[
{
"id": "summary",
"title": "Startup Funnel Overview",
"chartType": "kpi",
"size": { "width": 4, "height": 2.5 },
"data": [
{ "label": "Marketing Spend", "value": "$120k", "trend": { "value": "+5%", "direction": "up", "color": "green" } },
{ "label": "Leads Generated", "value": "8,000", "trend": { "value": "+12%", "direction": "up", "color": "green" } },
{ "label": "Revenue", "value": "$280k", "trend": { "value": "+9%", "direction": "up", "color": "green" } },
{ "label": "Marketing ROI", "value": "2.33x", "trend": { "value": "+4%", "direction": "up", "color": "green" } }
],
"semantic": { "processStep": 1, "segment": null, "detailLevel": 0 },
"processLabel": "Startup Funnel"
},
{
"id": "efficiency",
"title": "Marketing Efficiency Metrics",
"chartType": "kpi",
"size": { "width": 4, "height": 2.5 },
"data": [
{ "label": "Cost per Lead", "value": "$15", "trend": { "value": "-6%", "direction": "down", "color": "green" } },
{ "label": "CAC", "value": "$500", "trend": { "value": "-3%", "direction": "down", "color": "green" } },
{ "label": "LTV/CAC Ratio", "value": "5.6x", "trend": { "value": "+8%", "direction": "up", "color": "green" } }
],
"semantic": { "processStep": 0, "segment": 0, "detailLevel": 1 },
"parentId": "summary",
"segmentLabel": "Startup",
"processLabel": "Efficiency"
},
{
"id": "funnel",
"title": "Conversion Funnel",
"chartType": "funnel",
"size": { "width": 2.5, "height": 2.5 },
"data": [
{ "label": "Visitors", "value": 50000 },
{ "label": "Leads (16%)", "value": 8000 },
{ "label": "Opportunities (15%)", "value": 1200 },
{ "label": "Customers (20%)", "value": 240 }
],
"semantic": { "processStep": 1, "segment": 0, "detailLevel": 1 },
"parentId": "summary",
"segmentLabel": "Startup",
"processLabel": "Conversion"
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

OUTPUT FORMAT

Return a JSON object with this structure:
{
  "data": [ /* array of visualization panels */ ],
  "narrative": "A 2-3 sentence story explaining what the data shows and key takeaways",
  "keyInsights": [
    "Specific insight #1 with numbers/percentages",
    "Specific insight #2 with actionable recommendation",
    "Specific insight #3 highlighting trends or anomalies"
  ]
}

INSIGHT GUIDELINES:
- Each insight should be specific and data-driven (include actual numbers)
- Highlight trends, comparisons, anomalies, or recommendations
- Limit to 3-5 key insights
- Make insights actionable where possible

FINAL INSTRUCTION

Return ONLY the JSON object.
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
        const fullData = c.chart?.data
          ? JSON.stringify(c.chart.data)
          : 'No data';
        return `${idx + 1}. ID: ${c.id}
   Chart Type: ${c.chart?.chartType || 'unknown'}
   Title: ${c.chart?.title || 'Untitled'}
   Full Data: ${fullData}`;
      })
      .join('\n\n');

    return `User Query:
${query}

Available Structured Data:
${available_data}

CRITICAL INSTRUCTIONS:

1. DATA INTEGRITY: Use ONLY the actual data shown above. Every number must be traceable to the provided data.

2. INTELLIGENT ANALYSIS: Go beyond just displaying raw data. Think like a data analyst:
   - Calculate derived metrics (ROI, efficiency ratios, CAC, conversion rates, etc.)
   - Create comparative views (segment comparisons, rankings, best/worst performers)
   - Show multiple perspectives (overview, breakdown, trends, efficiency)
   - Combine data from multiple sources to reveal insights
   - Generate cross-functional analysis (marketing → leads → revenue connection)

3. CREATIVE VISUALIZATIONS: You are ENCOURAGED to create new visualizations that combine, transform, or analyze the data in insightful ways. Don't just mirror the raw data structure - add intelligence and analytical depth.

Generate the visualization JSON object following all system rules.

Return only valid JSON.`;
  }
}
