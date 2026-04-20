import { requireNonEmptyString } from "../../../core/validation/guards";

export interface HealthScoreFactor {
  id: string;
  health_score_id: string;
  factor_code: string;
  contribution: number;
  description: string;
}

export function createHealthScoreFactor(factor: HealthScoreFactor): HealthScoreFactor {
  return {
    id: requireNonEmptyString(factor.id, "id"),
    health_score_id: requireNonEmptyString(factor.health_score_id, "health_score_id"),
    factor_code: requireNonEmptyString(factor.factor_code, "factor_code"),
    contribution: factor.contribution,
    description: requireNonEmptyString(factor.description, "description"),
  };
}
