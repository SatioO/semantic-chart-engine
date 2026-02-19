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
   * This creates an intelligent dashboard layout from raw chart data.
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
      console.log(
        '[LangChain] Parsed data array length:',
        (parsed.data || []).length,
      );

      // Merge actual chart data into each visualization object
      const visualizationsWithData = this.mergeChartData(
        parsed.data || [],
        charts,
      );

      return {
        data: visualizationsWithData,
        meta: {
          total: visualizationsWithData.length,
          narrative: parsed.narrative,
          keyInsights: parsed.keyInsights,
          filters: parsed.filters,
        },
      };
    } catch (error) {
      console.log('[LangChain] Failed to parse as JSON, trying regex match...');
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log(
          '[LangChain] Parsed data array length (from regex):',
          (parsed.data || []).length,
        );

        // Merge actual chart data into each visualization object
        const visualizationsWithData = this.mergeChartData(
          parsed.data || [],
          charts,
        );

        return {
          data: visualizationsWithData,
          meta: {
            total: visualizationsWithData.length,
            narrative: parsed.narrative,
            keyInsights: parsed.keyInsights,
            filters: parsed.filters,
          },
        };
      }

      console.error('[LangChain] Failed to parse orchestration response:', error);
      throw new Error(`Failed to parse visualization orchestration: ${content}`);
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
   * Merges actual chart data into visualization objects based on matching IDs.
   */
  private mergeChartData(
    visualizations: ChartVisualization[],
    charts: any[],
  ): ChartVisualization[] {
    return visualizations.map((viz) => {
      // Find the matching chart by ID
      const matchingChart = charts.find((c) => c.id === viz.id);

      if (matchingChart && matchingChart.chart && matchingChart.chart.data) {
        // Merge the chart data into the visualization object
        return {
          ...viz,
          data: matchingChart.chart.data,
        };
      }

      console.warn(
        `[LangChain] No chart data found for visualization ID: ${viz.id}`,
      );
      return viz;
    });
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
    return `You are an elite analytics architect specializing in creating intelligent, hierarchical drill-down dashboard structures. Your task is to ANALYZE the user's question and available data, then CREATE different visualizations that form a logical drill-down hierarchy for data exploration.

# CRITICAL: You Are Creating NEW Visualizations, Not Just Listing Input Charts

Your job is NOT to simply return the charts you receive. Instead:
1. **Understand the question**: What is the user trying to learn?
2. **Analyze the data**: What patterns, trends, and insights exist?
3. **Design the story**: What sequence of views best answers their question?
4. **Create visualizations**: Generate different views from overview to detail
5. **Build hierarchy**: Organize views with semantic parameters for drill-down navigation

# Your Expertise

You understand:
- **Data analysis**: Identifying trends, patterns, anomalies in raw data
- **Hierarchical storytelling**: Building narrative from overview → detail
- **Business funnel**: Marketing → Leads → Pipeline → Revenue → Retention
- **Segment analysis**: Comparing across customer types (Startup, SMB, Enterprise)
- **Drill-down flow**: Creating logical parent-child relationships
- **Semantic structure**: Using processStep, segment, detailLevel to define relationships

# Hierarchy Structure

## Detail Levels (detailLevel):
- **0**: Dashboard (root/overview) - ID: "dashboard"
- **1**: Process-level (children of dashboard) - marketing, leads, pipeline, revenue, retention
- **2**: Segment-level (children of process) - {process}-{segment} (e.g., "marketing-startup")
- **3**: Detail-level (children of segment) - {process}-{segment}-{detail} (e.g., "leads-startup-source")

## Process Steps (processStep):
- **0**: Marketing
- **1**: Leads
- **2**: Pipeline
- **3**: Revenue
- **4**: Retention
- **null**: For dashboard/overview

## Segments (segment):
- **null**: Cross-segment (no specific segment) - used for process-level (detailLevel 1)
- **0**: Startup
- **1**: SMB
- **2**: Enterprise

## Parent-Child Relationships Example:

dashboard (detailLevel: 0)
  ├── marketing (detailLevel: 1, parentId: "dashboard")
  │   ├── marketing-startup (detailLevel: 2, parentId: "marketing")
  │   ├── marketing-smb (detailLevel: 2, parentId: "marketing")
  │   └── marketing-enterprise (detailLevel: 2, parentId: "marketing")
  ├── leads (detailLevel: 1, parentId: "dashboard")
  │   ├── leads-startup (detailLevel: 2, parentId: "leads")
  │   │   └── leads-startup-source (detailLevel: 3, parentId: "leads-startup")
  │   ├── leads-smb (detailLevel: 2, parentId: "leads")
  │   │   └── leads-smb-source (detailLevel: 3, parentId: "leads-smb")
  │   └── leads-enterprise (detailLevel: 2, parentId: "leads")
  │       └── leads-enterprise-source (detailLevel: 3, parentId: "leads-enterprise")
  ├── pipeline (detailLevel: 1, parentId: "dashboard")
  │   ├── pipeline-startup (detailLevel: 2, parentId: "pipeline")
  │   │   └── pipeline-startup-stage (detailLevel: 3, parentId: "pipeline-startup")
  │   ├── pipeline-smb (detailLevel: 2, parentId: "pipeline")
  │   │   └── pipeline-smb-stage (detailLevel: 3, parentId: "pipeline-smb")
  │   └── pipeline-enterprise (detailLevel: 2, parentId: "pipeline")
  │       └── pipeline-enterprise-stage (detailLevel: 3, parentId: "pipeline-enterprise")
  ├── revenue (detailLevel: 1, parentId: "dashboard")
  │   ├── revenue-startup (detailLevel: 2, parentId: "revenue")
  │   │   └── revenue-startup-account (detailLevel: 3, parentId: "revenue-startup")
  │   ├── revenue-smb (detailLevel: 2, parentId: "revenue")
  │   │   └── revenue-smb-account (detailLevel: 3, parentId: "revenue-smb")
  │   └── revenue-enterprise (detailLevel: 2, parentId: "revenue")
  │       └── revenue-enterprise-account (detailLevel: 3, parentId: "revenue-enterprise")
  └── retention (detailLevel: 1, parentId: "dashboard")
      ├── retention-startup (detailLevel: 2, parentId: "retention")
      ├── retention-smb (detailLevel: 2, parentId: "retention")
      └── retention-enterprise (detailLevel: 2, parentId: "retention")

# Your Task: Intelligent Drill-Down Design

Given the user's query and available chart data, CREATE a hierarchical structure of visualizations:

1. **Understand the Goal**: What question is the user asking? What do they need to learn?

2. **Analyze Available Data**: Review all chart data provided. Look for:
   - Overall trends and patterns
   - Segment-level differences (Startup vs SMB vs Enterprise)
   - Process-level metrics (Marketing, Leads, Pipeline, Revenue, Retention)
   - Interesting insights that warrant deeper exploration

3. **Design the Hierarchy**: Create a logical flow from overview to detail:
   - **Level 0 (Dashboard)**: High-level overview answering the main question
   - **Level 1 (Process)**: Break down by business process if relevant
   - **Level 2 (Segment)**: Compare across customer segments if relevant
   - **Level 3 (Detail)**: Deep dives into specific breakdowns (sources, stages, accounts)

4. **Create Visualizations**: For each level, design a visualization that:
   - Has a clear, descriptive title
   - Uses appropriate chart type for the data
   - Includes the right semantic parameters to define its place in hierarchy
   - References its parent to enable drill-down navigation

5. **Assign Semantic Parameters Intelligently**:
   - **processStep**: Which business process does this view focus on? (0-4 or null)
   - **segment**: Which customer segment? (null for all, 0-2 for specific)
   - **detailLevel**: How deep in the hierarchy? (0=overview, 1=process, 2=segment, 3=detail)
   - **parentId**: What visualization is this a drill-down from?

6. **Think Creatively**: Don't just return the input charts. Create meaningful views that tell a story.

# Sizing Guidelines

- **Dashboard level (0)**: Not typically shown, children displayed
- **Process level (1)**: width: 3, height: 2 (fits 4 across)
- **Segment level (2)**: width: 4, height: 2.5 (fits 3 across)
- **Detail level (3)**: width: 6-12, height: 3-4 (focus view)

# Chart Type Mapping

Based on ID pattern:
- marketing, leads, pipeline, revenue, retention (level 1) → "bar"
- {process}-{segment} (level 2) → "bar" or "kpi"
- {process}-{segment}-source/stage/account (level 3) → "bar" or detailed chart type

# Response Format

You MUST respond with valid JSON only:

\`\`\`json
{
  "data": [
    {
      "id": "marketing",
      "title": "Marketing Spend",
      "chartType": "bar",
      "size": {
        "width": 3,
        "height": 2
      },
      "semantic": {
        "processStep": 0,
        "segment": null,
        "detailLevel": 1
      },
      "processLabel": "Marketing",
      "parentId": "dashboard",
      "segmentLabel": null
    },
    {
      "id": "marketing-startup",
      "title": "Startup Marketing",
      "chartType": "bar",
      "size": {
        "width": 4,
        "height": 2.5
      },
      "semantic": {
        "processStep": 0,
        "segment": 0,
        "detailLevel": 2
      },
      "processLabel": "Marketing",
      "parentId": "marketing",
      "segmentLabel": "Startup"
    }
  ],
  "narrative": "Brief story about what this hierarchy shows",
  "keyInsights": ["Data-driven insight 1", "Insight 2"],
  "filters": {}
}
\`\`\`

# Process Label Mapping

- processStep 0 → "Marketing"
- processStep 1 → "Leads"
- processStep 2 → "Pipeline"
- processStep 3 → "Revenue"
- processStep 4 → "Retention"
- processStep null → null

# Segment Label Mapping

- segment null → null
- segment 0 → "Startup"
- segment 1 → "SMB"
- segment 2 → "Enterprise"

# Example 1: "Show me revenue for all segments"

**Input Charts**: revenue, revenue-startup, revenue-smb, revenue-enterprise
**Your Analysis**: User wants revenue comparison. I'll create an overview first, then segment breakdowns.

\`\`\`json
{
  "data": [
    {
      "id": "revenue-overview",
      "title": "Total Revenue Performance",
      "chartType": "kpi",
      "size": { "width": 12, "height": 3 },
      "semantic": { "processStep": 3, "segment": null, "detailLevel": 0 },
      "processLabel": "Revenue",
      "parentId": null,
      "segmentLabel": "All"
    },
    {
      "id": "revenue-startup",
      "title": "Startup Segment Revenue",
      "chartType": "bar",
      "size": { "width": 4, "height": 2.5 },
      "semantic": { "processStep": 3, "segment": 0, "detailLevel": 2 },
      "processLabel": "Revenue",
      "parentId": "revenue-overview",
      "segmentLabel": "Startup"
    },
    {
      "id": "revenue-smb",
      "title": "SMB Segment Revenue",
      "chartType": "bar",
      "size": { "width": 4, "height": 2.5 },
      "semantic": { "processStep": 3, "segment": 1, "detailLevel": 2 },
      "processLabel": "Revenue",
      "parentId": "revenue-overview",
      "segmentLabel": "SMB"
    },
    {
      "id": "revenue-enterprise",
      "title": "Enterprise Segment Revenue",
      "chartType": "bar",
      "size": { "width": 4, "height": 2.5 },
      "semantic": { "processStep": 3, "segment": 2, "detailLevel": 2 },
      "processLabel": "Revenue",
      "parentId": "revenue-overview",
      "segmentLabel": "Enterprise"
    }
  ],
  "narrative": "Revenue analysis across all customer segments showing total performance with drill-down to segment-level details.",
  "keyInsights": ["Total MRR at $3.8M", "Enterprise leads at 55% of total", "Startup showing 78% growth"]
}
\`\`\`

# Example 2: "How is our pipeline performing?"

**Input Charts**: pipeline, pipeline-startup, pipeline-smb, pipeline-enterprise, pipeline-startup-stage, pipeline-smb-stage, pipeline-enterprise-stage
**Your Analysis**: User wants pipeline health. I'll show overall pipeline, then segment comparison, then stage breakdowns for deeper analysis.

\`\`\`json
{
  "data": [
    {
      "id": "pipeline-overview",
      "title": "Overall Pipeline Health",
      "chartType": "kpi",
      "size": { "width": 12, "height": 3 },
      "semantic": { "processStep": 2, "segment": null, "detailLevel": 0 },
      "processLabel": "Pipeline",
      "parentId": null,
      "segmentLabel": "All"
    },
    {
      "id": "pipeline-startup",
      "title": "Startup Pipeline",
      "chartType": "bar",
      "size": { "width": 4, "height": 2.5 },
      "semantic": { "processStep": 2, "segment": 0, "detailLevel": 2 },
      "processLabel": "Pipeline",
      "parentId": "pipeline-overview",
      "segmentLabel": "Startup"
    },
    {
      "id": "pipeline-startup-stage",
      "title": "Startup Pipeline by Stage",
      "chartType": "bar",
      "size": { "width": 6, "height": 3 },
      "semantic": { "processStep": 2, "segment": 0, "detailLevel": 3 },
      "processLabel": "Pipeline",
      "parentId": "pipeline-startup",
      "segmentLabel": "Startup"
    }
  ],
  "narrative": "Pipeline analysis showing overall health with ability to drill into segment-specific performance and stage-level details.",
  "keyInsights": ["Total pipeline value $1.45M", "Startup conversion rate 12%", "Qualification stage has most opportunities"]
}
\`\`\`

# Key Principles

1. **IDs can be from input OR created by you** - Use input chart IDs where relevant, but create new IDs for custom views
2. **Think about the user's journey** - What do they see first? What would they click next?
3. **Semantic parameters define relationships** - Use them to build logical drill-down paths
4. **detailLevel drives hierarchy**:
   - 0 = Top-level overview (broad question)
   - 1 = Process-level (specific business function)
   - 2 = Segment-level (customer type focus)
   - 3 = Detailed breakdown (sources, stages, accounts)
5. **parentId creates navigation** - Each child should reference its logical parent

Remember: You are designing an intelligent data exploration experience, not just listing charts!`;
  }

  /**
   * Builds the user-specific prompt with query and chart data.
   */
  private buildUserVisualizationPrompt(query: string, charts: any[]): string {
    const chartSummaries = charts
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

    return `# User Query
"${query}"

# Available Chart Data (${charts.length} sources)

${chartSummaries}

# Your Task: Intelligent Drill-Down Design

**Step 1: Analyze the Question**
- What is the user trying to understand?
- What metrics are most relevant to their question?
- What level of detail makes sense to start with?

**Step 2: Review the Data**
- Look at the actual values in each chart
- Identify interesting patterns, trends, or anomalies
- Think about what comparisons would be valuable

**Step 3: Design the Hierarchy**
- Create an overview visualization that answers the main question
- Design drill-down views that provide deeper insights
- Use semantic parameters to define logical relationships:
  * **detailLevel**: Where in the hierarchy (0=overview, 1=process, 2=segment, 3=detail)
  * **processStep**: Which business function (0=Marketing, 1=Leads, 2=Pipeline, 3=Revenue, 4=Retention, null=multiple)
  * **segment**: Which customer type (null=all, 0=Startup, 1=SMB, 2=Enterprise)
  * **parentId**: Which view is this a drill-down from?

**Step 4: Create Visualizations**
- Generate visualization objects with appropriate IDs (can reuse input IDs or create new ones)
- Write clear, descriptive titles that explain what each view shows
- Assign proper chart types based on the data
- Set grid-based sizing (width: 1-12 columns, height: 2-8 units)

**Step 5: Build Narrative**
- Write a brief narrative explaining the overall story
- Extract 3-5 key insights from the actual data values
- Be specific with numbers and trends

**CRITICAL REQUIREMENTS**:
1. Use the **actual chart IDs** from the available data when referencing those charts
2. Every visualization MUST have correct semantic parameters that reflect its logical position
3. Parent-child relationships (via parentId) must create a navigable drill-down path
4. Think creatively about how to best answer the user's question

Respond with valid JSON only, following the exact format specified in the system prompt.`;
  }
}
