import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { AccountsRepository } from "../../../accounts/application/ports/accounts-repository";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { WorkerJobsRepository } from "../../../execution/application/ports/worker-jobs-repository";
import type { QueueAccountAutomationTick } from "../../../orchestration/application/commands/queue-account-automation-tick";
import type { SourcesRepository } from "../../../sources/application/ports/sources-repository";
import type { SourceWatchlistsRepository } from "../ports/source-watchlists-repository";
import type { RecurringBriefPlansRepository } from "../ports/recurring-brief-plans-repository";
import { createRecurringBriefPlan, type RecurringBriefPlanQueueItem } from "../../domain/editorial";
import { computeNextRecurringRunAfter } from "../../domain/recurring-schedule";
import { syncRecurringBriefPlanWorkerJob } from "../worker-job-sync";

export interface UpsertRecurringBriefPlanDependencies {
  accounts: AccountsRepository;
  sources: SourcesRepository;
  watchlists: SourceWatchlistsRepository;
  plans: RecurringBriefPlansRepository;
  workerJobs: WorkerJobsRepository;
  queueAccountAutomationTick: QueueAccountAutomationTick;
  auditLogs: AuditLogRepository;
  clock: Clock;
}

export class UpsertRecurringBriefPlan {
  constructor(private readonly deps: UpsertRecurringBriefPlanDependencies) {}

  async execute(input: {
    plan_id?: string;
    account_id: string;
    name: string;
    description?: string;
    cadence_body: {
      timezone: string;
      weekday_codes: Array<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun">;
      slot_times: string[];
      min_spacing_minutes: number;
    };
    strategy_body: {
      generation_mode: "from_trend" | "from_source_scope";
      watchlist_id?: string;
      source_scope_body?: {
        source_ids: string[];
        source_types: Array<"rss" | "website" | "twitter" | "youtube" | "substack" | "telegram">;
        preferred_source_ids: string[];
        preferred_source_types: Array<"rss" | "website" | "twitter" | "youtube" | "substack" | "telegram">;
        query?: string;
        max_source_age_days: number;
        limit: number;
      };
      default_topic_hint?: string;
      default_angle_hint?: string;
      default_audience?: string;
      campaign_queue: Array<{
        id?: string;
        title: string;
        topic_hint: string;
        angle_hint?: string;
        audience?: string;
      }>;
    };
    status: "active" | "paused";
  }) {
    const account = await this.deps.accounts.findById(input.account_id);
    if (!account) {
      throw new AppError("NOT_FOUND", "account not found", {
        details: { account_id: input.account_id },
      });
    }

    const existing = input.plan_id ? await this.deps.plans.findById(input.plan_id) : null;
    if (existing && existing.account_id !== account.id) {
      throw new AppError("NOT_FOUND", "recurring brief plan not found", {
        details: { plan_id: input.plan_id, account_id: account.id },
      });
    }

    if (input.strategy_body.watchlist_id) {
      const watchlist = await this.deps.watchlists.findById(input.strategy_body.watchlist_id);
      if (!watchlist || watchlist.account_id !== account.id) {
        throw new AppError("VALIDATION_ERROR", "watchlist_id must resolve to a watchlist owned by the target account", {
          details: { account_id: account.id, watchlist_id: input.strategy_body.watchlist_id },
        });
      }
    }
    if (input.strategy_body.source_scope_body) {
      await assertOwnedSources(this.deps.sources, account.id, [
        ...input.strategy_body.source_scope_body.source_ids,
        ...input.strategy_body.source_scope_body.preferred_source_ids,
      ]);
    }

    const now = this.deps.clock.now().toISOString();
    const campaignQueue = buildCampaignQueue(input.strategy_body.campaign_queue, existing?.strategy_body.campaign_queue ?? []);
    const draftPlan = createRecurringBriefPlan({
      id: existing?.id ?? newId(),
      workspace_id: account.workspace_id,
      account_id: account.id,
      name: input.name,
      description: input.description,
      cadence_body: input.cadence_body,
      strategy_body: {
        generation_mode: input.strategy_body.generation_mode,
        watchlist_id: input.strategy_body.watchlist_id,
        source_scope_body: input.strategy_body.source_scope_body,
        default_topic_hint: input.strategy_body.default_topic_hint,
        default_angle_hint: input.strategy_body.default_angle_hint,
        default_audience: input.strategy_body.default_audience,
        campaign_queue: campaignQueue,
      },
      status: input.status,
      next_run_after: input.status === "active"
        ? computeNextRecurringRunAfter({
          cadence: input.cadence_body,
          now,
          not_before: existing?.last_enqueued_at
            ? new Date(Date.parse(existing.last_enqueued_at) + input.cadence_body.min_spacing_minutes * 60_000).toISOString()
            : now,
        })
        : undefined,
      last_attempted_at: existing?.last_attempted_at,
      last_run_status: existing?.last_run_status,
      last_failed_at: existing?.last_failed_at,
      last_error_code: existing?.last_error_code,
      last_error_message: existing?.last_error_message,
      last_enqueued_at: existing?.last_enqueued_at,
      last_brief_id: existing?.last_brief_id,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    });

    await this.deps.plans.save(draftPlan);
    await syncRecurringBriefPlanWorkerJob(this.deps.workerJobs, this.deps.clock, draftPlan);
    await this.deps.auditLogs.append({
      id: newId(),
      workspace_id: draftPlan.workspace_id,
      actor_type: "user",
      entity_type: "recurring_brief_plan",
      entity_id: draftPlan.id,
      action: existing ? "recurring_brief_plan.updated" : "recurring_brief_plan.created",
      before_state: existing ? JSON.stringify(existing) : undefined,
      after_state: JSON.stringify(draftPlan),
      created_at: now,
    });
    if (draftPlan.status === "active") {
      await this.deps.queueAccountAutomationTick.execute({
        account_id: draftPlan.account_id,
        trigger_kind: "system",
        create_if_missing: true,
      });
    }

    return { plan: draftPlan };
  }
}

async function assertOwnedSources(
  sources: SourcesRepository,
  accountId: string,
  sourceIds: string[],
) {
  if (sourceIds.length === 0) {
    return;
  }

  const accountSources = await sources.listSourcesByAccountId(accountId);
  const allowedSourceIds = new Set(accountSources.map((source) => source.id));
  const invalid = Array.from(new Set(sourceIds.map((item) => item.trim()).filter((item) => item !== ""))).filter((sourceId) => !allowedSourceIds.has(sourceId));
  if (invalid.length > 0) {
    throw new AppError("VALIDATION_ERROR", "recurring brief plan source_ids must belong to the target account", {
      details: { account_id: accountId, source_ids: invalid },
    });
  }
}

function buildCampaignQueue(
  input: Array<{
    id?: string;
    title: string;
    topic_hint: string;
    angle_hint?: string;
    audience?: string;
  }>,
  existing: RecurringBriefPlanQueueItem[],
): RecurringBriefPlanQueueItem[] {
  const existingById = new Map(existing.map((item) => [item.id, item]));
  return input.map((item) => {
    const reused = item.id ? existingById.get(item.id) : undefined;
    return {
      id: item.id?.trim() || newId(),
      title: item.title,
      topic_hint: item.topic_hint,
      angle_hint: item.angle_hint,
      audience: item.audience,
      status: reused?.status === "consumed" ? "consumed" : "queued",
      consumed_at: reused?.status === "consumed" ? reused.consumed_at : undefined,
    };
  });
}
