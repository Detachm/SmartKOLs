import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { AccountsRepository } from "../../../accounts/application/ports/accounts-repository";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { GenerateRiskEvents } from "../../../risk/application/commands/generate-risk-events";
import type { HealthScoreFactorsRepository } from "../ports/health-score-factors-repository";
import type { HealthScoresRepository } from "../ports/health-scores-repository";
import { createHealthScoreFactor } from "../../domain/health-score-factor";
import { createHealthScore } from "../../domain/health-score";

function clampScore(score: number) {
  return Math.max(0, Math.min(100, score));
}

export interface ComputeAccountHealthScoreDependencies {
  accounts: AccountsRepository;
  healthScores: HealthScoresRepository;
  factors: HealthScoreFactorsRepository;
  auditLogs: AuditLogRepository;
  generateRiskEvents: GenerateRiskEvents;
  clock: Clock;
}

export class ComputeAccountHealthScore {
  constructor(private readonly deps: ComputeAccountHealthScoreDependencies) {}

  async execute(accountId: string) {
    const account = await this.deps.accounts.findById(accountId);
    if (!account) {
      throw new AppError("NOT_FOUND", "account not found", {
        details: { account_id: accountId },
      });
    }

    const factorInputs = [
      {
        factor_code: "account_status",
        contribution: account.status === "active" ? 0 : -35,
        description: account.status === "active" ? "account status is active" : `account status is ${account.status}`,
      },
      {
        factor_code: "post_volume",
        contribution: account.post_count === 0 ? -25 : account.post_count < 5 ? -10 : 5,
        description: `account post_count is ${account.post_count}`,
      },
      {
        factor_code: "audience_size",
        contribution: account.follower_count < 100 ? -15 : account.follower_count < 1000 ? -5 : 10,
        description: `account follower_count is ${account.follower_count}`,
      },
      {
        factor_code: "following_ratio",
        contribution: account.following_count > Math.max(account.follower_count * 3, 300) ? -20 : 0,
        description: `account following_count is ${account.following_count}`,
      },
    ];

    const rawScore = 100 + factorInputs.reduce((sum, factor) => sum + factor.contribution, 0);
    const score = clampScore(rawScore);
    const riskLevel = score >= 80 ? "low" as const : score >= 50 ? "medium" as const : "high" as const;
    const computedAt = this.deps.clock.now().toISOString();
    const healthScore = createHealthScore({
      id: newId(),
      workspace_id: account.workspace_id,
      account_id: account.id,
      score,
      risk_level: riskLevel,
      computed_at: computedAt,
    });
    const factors = factorInputs.map((factor) => createHealthScoreFactor({
      id: newId(),
      health_score_id: healthScore.id,
      factor_code: factor.factor_code,
      contribution: factor.contribution,
      description: factor.description,
    }));

    await this.deps.healthScores.save(healthScore);
    await this.deps.factors.replaceForHealthScore(healthScore.id, factors);
    if (healthScore.risk_level !== "low") {
      await this.deps.generateRiskEvents.execute({
        workspace_id: account.workspace_id,
        account_id: account.id,
        severity: healthScore.risk_level,
        code: "account.health.degraded",
        title: `Account health ${healthScore.risk_level}`,
        detail: `${account.handle} health score is ${healthScore.score}`,
      });
    }
    await this.deps.auditLogs.append({
      id: newId(),
      workspace_id: account.workspace_id,
      actor_type: "system",
      entity_type: "health_score",
      entity_id: healthScore.id,
      action: "health_score.computed",
      after_state: JSON.stringify({ health_score: healthScore, factors }),
      created_at: computedAt,
    });

    return {
      health_score: healthScore,
      factors,
    };
  }
}
