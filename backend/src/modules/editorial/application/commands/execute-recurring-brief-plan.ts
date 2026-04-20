import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { RefreshTrends } from "../../../trends/application/commands/refresh-trends";
import type { TrendsRepository } from "../../../trends/application/ports/trends-repository";
import type { GenerateContentBrief } from "../../../content-briefs/application/commands/generate-content-brief";
import type { RecurringBriefPlansRepository } from "../ports/recurring-brief-plans-repository";
import type { SourceWatchlistsRepository } from "../ports/source-watchlists-repository";
import { computeNextRecurringRunAfter } from "../../domain/recurring-schedule";
import { consumeRecurringPlanQueueItem, createRecurringBriefPlan, type RecurringBriefPlan, type SourceWatchlist } from "../../domain/editorial";
import { syncRecurringBriefPlanWorkerJob } from "../worker-job-sync";
import type { WorkerJobsRepository } from "../../../execution/application/ports/worker-jobs-repository";

export interface ExecuteRecurringBriefPlanDependencies {
  plans: RecurringBriefPlansRepository;
  watchlists: SourceWatchlistsRepository;
  trends: TrendsRepository;
  refreshTrends: RefreshTrends;
  generateContentBrief: GenerateContentBrief;
  workerJobs: WorkerJobsRepository;
  auditLogs: AuditLogRepository;
  clock: Clock;
}

export class ExecuteRecurringBriefPlan {
  constructor(private readonly deps: ExecuteRecurringBriefPlanDependencies) {}

  async execute(planId: string) {
    const plan = await this.deps.plans.findById(planId);
    if (!plan) {
      throw new AppError("NOT_FOUND", "recurring brief plan not found", {
        details: { plan_id: planId },
      });
    }
    if (plan.status !== "active") {
      throw new AppError("INVALID_STATE", "recurring brief plan must be active before execution", {
        details: { plan_id: plan.id, status: plan.status },
      });
    }

    const now = this.deps.clock.now().toISOString();
    const queueItem = plan.strategy_body.campaign_queue.find((item) => item.status === "queued");
    const defaultTopicHint = queueItem?.topic_hint ?? plan.strategy_body.default_topic_hint;
    const defaultAngleHint = queueItem?.angle_hint ?? plan.strategy_body.default_angle_hint;
    const defaultAudience = queueItem?.audience ?? plan.strategy_body.default_audience;

    let result: { brief_id: string; task_id: string };
    if (plan.strategy_body.generation_mode === "from_source_scope") {
      const watchlist = plan.strategy_body.watchlist_id ? await requireWatchlist(this.deps.watchlists, plan, plan.strategy_body.watchlist_id) : undefined;
      const preset = watchlist?.scope_body ?? plan.strategy_body.source_scope_body;
      if (!preset) {
        throw new AppError("INVALID_STATE", "from_source_scope recurring plan is missing source scope", {
          details: { plan_id: plan.id },
        });
      }

      result = await this.deps.generateContentBrief.execute({
        account_id: plan.account_id,
        source_scope: {
          kind: "account_active_sources",
          source_ids: preset.source_ids,
          source_types: preset.source_types,
          preferred_source_ids: preset.preferred_source_ids,
          preferred_source_types: preset.preferred_source_types,
          query: preset.query,
          published_from: new Date(Date.parse(now) - preset.max_source_age_days * 24 * 60 * 60 * 1000).toISOString(),
          published_to: now,
          limit: preset.limit,
        },
        topic_hint: defaultTopicHint,
        audience: defaultAudience,
        angle_hint: defaultAngleHint,
      });
    } else {
      await this.deps.refreshTrends.execute(plan.workspace_id);
      const trends = await this.deps.trends.listByWorkspaceId(plan.workspace_id);
      const trend = pickTrend(trends, defaultTopicHint);
      if (!trend) {
        throw new AppError("NOT_FOUND", "no trend matched the recurring brief plan", {
          details: { plan_id: plan.id, topic_hint: defaultTopicHint },
        });
      }

      result = await this.deps.generateContentBrief.execute({
        account_id: plan.account_id,
        trend_id: trend.id,
        topic_hint: defaultTopicHint,
        audience: defaultAudience,
        angle_hint: defaultAngleHint,
      });
    }

    let nextPlan: RecurringBriefPlan = createRecurringBriefPlan({
      ...plan,
      last_brief_id: result.brief_id,
      last_attempted_at: now,
      last_run_status: "succeeded",
      last_failed_at: undefined,
      last_error_code: undefined,
      last_error_message: undefined,
      last_enqueued_at: now,
      next_run_after: computeNextRecurringRunAfter({
        cadence: plan.cadence_body,
        now,
        not_before: new Date(Date.parse(now) + plan.cadence_body.min_spacing_minutes * 60_000).toISOString(),
      }),
      updated_at: now,
    });
    let consumedCampaignItem = undefined;
    if (queueItem) {
      const consumed = consumeRecurringPlanQueueItem(nextPlan, queueItem.id, now);
      nextPlan = consumed.plan;
      consumedCampaignItem = consumed.item;
    }

    await this.deps.plans.save(nextPlan);
    await syncRecurringBriefPlanWorkerJob(this.deps.workerJobs, this.deps.clock, nextPlan);
    await this.deps.auditLogs.append({
      id: newId(),
      workspace_id: nextPlan.workspace_id,
      actor_type: "system",
      entity_type: "recurring_brief_plan",
      entity_id: nextPlan.id,
      action: "recurring_brief_plan.executed",
      before_state: JSON.stringify(plan),
      after_state: JSON.stringify(nextPlan),
      created_at: now,
    });

    return {
      plan: nextPlan,
      brief_id: result.brief_id,
      task_id: result.task_id,
      consumed_campaign_item: consumedCampaignItem,
    };
  }
}

async function requireWatchlist(
  watchlists: SourceWatchlistsRepository,
  plan: RecurringBriefPlan,
  watchlistId: string,
): Promise<SourceWatchlist> {
  const watchlist = await watchlists.findById(watchlistId);
  if (!watchlist || watchlist.account_id !== plan.account_id) {
    throw new AppError("INVALID_STATE", "recurring brief plan watchlist is missing or no longer belongs to the account", {
      details: { plan_id: plan.id, watchlist_id: watchlistId },
    });
  }
  if (watchlist.status !== "active") {
    throw new AppError("INVALID_STATE", "recurring brief plan watchlist must be active", {
      details: { plan_id: plan.id, watchlist_id: watchlist.id, status: watchlist.status },
    });
  }
  return watchlist;
}

function pickTrend(
  trends: Array<{ id: string; topic: string; score: number }>,
  topicHint?: string,
) {
  if (trends.length === 0) {
    return undefined;
  }

  if (!topicHint || topicHint.trim() === "") {
    return trends[0];
  }

  const terms = normalizeTerms(topicHint);
  const ranked = trends
    .map((trend) => ({
      trend,
      score: scoreText(trend.topic, terms) + trend.score,
    }))
    .sort((left, right) => right.score - left.score);

  if (ranked[0]?.score === ranked[0]?.trend.score) {
    throw new AppError("NOT_FOUND", "no trend matched the recurring brief topic hint", {
      details: { topic_hint: topicHint },
    });
  }

  return ranked[0]?.trend;
}

function normalizeTerms(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff\s]/g, " ")
    .split(/\s+/)
    .filter((term) => term.length >= 2);
}

function scoreText(value: string, terms: string[]) {
  const lower = value.toLowerCase();
  return terms.reduce((score, term) => lower.includes(term) ? score + 1.5 : score, 0);
}
