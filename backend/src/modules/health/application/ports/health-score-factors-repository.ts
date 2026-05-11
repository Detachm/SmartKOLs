import type { HealthScoreFactor } from "../../domain/health-score-factor";

export interface HealthScoreFactorsRepository {
  replaceForHealthScore(healthScoreId: string, factors: HealthScoreFactor[]): Promise<void>;
  listByHealthScoreId(healthScoreId: string): Promise<HealthScoreFactor[]>;
}
