import { requireNonEmptyString, requireOneOf } from "../../../core/validation/guards";

export type TrendStatus = "active" | "cooling" | "archived";

export interface TrendSourcePreview {
  source_id: string;
  source_name: string;
  account_id: string;
  account_handle: string;
  document_count: number;
}

export interface Trend {
  id: string;
  workspace_id: string;
  cluster_key: string;
  topic: string;
  category: string;
  score: number;
  status: TrendStatus;
  detected_at: string;
  updated_at: string;
  source_count?: number;
  account_count?: number;
  sources?: TrendSourcePreview[];
}

export function createTrend(trend: Trend): Trend {
  return {
    id: requireNonEmptyString(trend.id, "id"),
    workspace_id: requireNonEmptyString(trend.workspace_id, "workspace_id"),
    cluster_key: requireNonEmptyString(trend.cluster_key, "cluster_key"),
    topic: requireNonEmptyString(trend.topic, "topic"),
    category: requireNonEmptyString(trend.category, "category"),
    score: trend.score,
    status: requireOneOf(trend.status, "status", ["active", "cooling", "archived"] as const),
    detected_at: requireNonEmptyString(trend.detected_at, "detected_at"),
    updated_at: requireNonEmptyString(trend.updated_at, "updated_at"),
    source_count: trend.source_count,
    account_count: trend.account_count,
    sources: trend.sources?.map((source) => ({
      source_id: requireNonEmptyString(source.source_id, "source_id"),
      source_name: requireNonEmptyString(source.source_name, "source_name"),
      account_id: requireNonEmptyString(source.account_id, "account_id"),
      account_handle: requireNonEmptyString(source.account_handle, "account_handle"),
      document_count: source.document_count,
    })),
  };
}
