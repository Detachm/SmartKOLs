import { AppError } from "../../../../core/errors/app-error";
import type { HealthScoreFactorsRepository } from "../ports/health-score-factors-repository";
import type { HealthScoresRepository } from "../ports/health-scores-repository";

export interface GetAccountHealthFactorsDependencies {
  healthScores: HealthScoresRepository;
  factors: HealthScoreFactorsRepository;
}

export class GetAccountHealthFactors {
  constructor(private readonly deps: GetAccountHealthFactorsDependencies) {}

  async execute(accountId: string) {
    const score = await this.deps.healthScores.findLatestByAccountId(accountId);
    if (!score) {
      throw new AppError("NOT_FOUND", "health score not found", {
        details: { account_id: accountId },
      });
    }

    return {
      health_score: score,
      factors: await this.deps.factors.listByHealthScoreId(score.id),
    };
  }
}
