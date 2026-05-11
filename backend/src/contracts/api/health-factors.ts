import type { HealthScore } from "../../modules/health/domain/health-score";
import type { HealthScoreFactor } from "../../modules/health/domain/health-score-factor";

export interface HealthFactorsResponse {
  health_score: HealthScore;
  factors: HealthScoreFactor[];
}
