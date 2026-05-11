import { requireNonEmptyString, requireOneOf } from "../../../core/validation/guards";

export type HealthRiskLevel = "low" | "medium" | "high";

export interface HealthScore {
  id: string;
  workspace_id: string;
  account_id: string;
  score: number;
  risk_level: HealthRiskLevel;
  computed_at: string;
}

export function createHealthScore(score: HealthScore): HealthScore {
  return {
    id: requireNonEmptyString(score.id, "id"),
    workspace_id: requireNonEmptyString(score.workspace_id, "workspace_id"),
    account_id: requireNonEmptyString(score.account_id, "account_id"),
    score: score.score,
    risk_level: requireOneOf(score.risk_level, "risk_level", ["low", "medium", "high"] as const),
    computed_at: requireNonEmptyString(score.computed_at, "computed_at"),
  };
}
