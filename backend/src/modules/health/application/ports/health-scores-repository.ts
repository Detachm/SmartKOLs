import type { HealthScore } from "../../domain/health-score";

export interface HealthScoresRepository {
  save(score: HealthScore): Promise<void>;
  findLatestByAccountId(accountId: string): Promise<HealthScore | null>;
}
