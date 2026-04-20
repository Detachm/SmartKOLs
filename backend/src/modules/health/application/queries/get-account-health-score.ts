import { AppError } from "../../../../core/errors/app-error";
import type { HealthScoresRepository } from "../ports/health-scores-repository";

export interface GetAccountHealthScoreDependencies {
  healthScores: HealthScoresRepository;
}

export class GetAccountHealthScore {
  constructor(private readonly deps: GetAccountHealthScoreDependencies) {}

  async execute(accountId: string) {
    const score = await this.deps.healthScores.findLatestByAccountId(accountId);
    if (!score) {
      throw new AppError("NOT_FOUND", "health score not found", {
        details: { account_id: accountId },
      });
    }

    return { health_score: score };
  }
}
