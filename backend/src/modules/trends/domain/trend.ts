import { requireNonEmptyString, requireOneOf } from "../../../core/validation/guards";

export type TrendStatus = "active" | "cooling" | "archived";

export interface Trend {
  id: string;
  workspace_id: string;
  topic: string;
  category: string;
  score: number;
  status: TrendStatus;
  detected_at: string;
  updated_at: string;
}

export function createTrend(trend: Trend): Trend {
  return {
    id: requireNonEmptyString(trend.id, "id"),
    workspace_id: requireNonEmptyString(trend.workspace_id, "workspace_id"),
    topic: requireNonEmptyString(trend.topic, "topic"),
    category: requireNonEmptyString(trend.category, "category"),
    score: trend.score,
    status: requireOneOf(trend.status, "status", ["active", "cooling", "archived"] as const),
    detected_at: requireNonEmptyString(trend.detected_at, "detected_at"),
    updated_at: requireNonEmptyString(trend.updated_at, "updated_at"),
  };
}
