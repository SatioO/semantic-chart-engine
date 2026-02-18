// ── Chart types present in the 3DAnalytics data ────────────────────────────
export type ChartType = 'kpi' | 'bar' | 'funnel' | 'revenue' | 'churn';

export type TrendDirection = 'up' | 'down' | 'flat';

// ── Per-chartType data item shapes ──────────────────────────────────────────

/** Used by chartType: "kpi" */
export interface KpiDataItem {
  label: string;
  value: number;
  unit: string;
  trend: number;
  trendDirection: TrendDirection;
}

/** Used by chartType: "bar" */
export interface BarDataItem {
  product: string;
  revenue: number;
  growth: number;
}

/** Used by chartType: "funnel" */
export interface FunnelDataItem {
  stage: string;
  count: number;
  conversionRate: number;
}

/** Used by chartType: "revenue" */
export interface RevenueDataItem {
  month: string;
  mrr: number;
  arr: number;
  newRevenue: number;
  churnedRevenue: number;
}

/** Used by chartType: "churn" */
export interface ChurnDataItem {
  month: string;
  churnRate: number;
  customers: number;
  churned: number;
}

export type ChartDataItem =
  | KpiDataItem
  | BarDataItem
  | FunnelDataItem
  | RevenueDataItem
  | ChurnDataItem;

// ── Semantic metadata ────────────────────────────────────────────────────────

/**
 * processStep maps to a named stage in the SaaS funnel:
 *   0 = Marketing, 1 = Leads, 2 = Pipeline, 3 = Revenue, 4 = Retention
 *
 * segment maps to a customer segment:
 *   null = all segments, 0 = Startup, 1 = SMB, 2 = Enterprise
 *
 * detailLevel maps to drill-down depth:
 *   0 = Overview, 1 = Process, 2 = Segment, 3 = Detail
 */
export interface SemanticMeta {
  processStep: number;
  segment: number | null;
  detailLevel: number;
}

export interface ChartSize {
  width: number;
  height: number;
}

// ── Core chart shapes ────────────────────────────────────────────────────────

/** Full chart including dataset payload */
export interface Chart {
  id: string;
  title: string;
  chartType: ChartType;
  size: ChartSize;
  data: ChartDataItem[];
  semantic: SemanticMeta;
  processLabel: string;
  parentId?: string;
  segmentLabel?: string;
}

/** Lightweight summary — data payload excluded */
export interface ChartSummary {
  id: string;
  title: string;
  chartType: ChartType;
  size: ChartSize;
  semantic: SemanticMeta;
  processLabel: string;
  parentId?: string;
  segmentLabel?: string;
}

// ── Platform info ────────────────────────────────────────────────────────────

export interface PlatformInfo {
  id: string;
  name: string;
  description: string;
  version: string;
}

// ── Query filter options ─────────────────────────────────────────────────────

export interface ChartFilterOptions {
  /** Filter by semantic.detailLevel */
  detailLevel?: number;
  /** Filter by semantic.processStep */
  processStep?: number;
  /** Filter by semantic.segment (pass -1 to get charts with segment === null) */
  segment?: number;
  /** Return only direct children of this chart id */
  parentId?: string;
  /** Filter by chartType */
  chartType?: ChartType;
}

// ── API response envelope ────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  platform: string;
  data: T;
  meta?: {
    total?: number;
    filters?: ChartFilterOptions;
    [key: string]: unknown;
  };
}

export interface ApiError {
  success: false;
  error: string;
  statusCode: number;
}
