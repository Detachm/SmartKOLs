import type { HealthScore } from "../../modules/health/domain/health-score";

export interface HealthScoreResponse {
  health_score: HealthScore;
}
