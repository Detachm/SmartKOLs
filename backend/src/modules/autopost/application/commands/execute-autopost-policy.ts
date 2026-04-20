import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { AutopostRunNowResponse } from "../../../../contracts/api/autopost-policies";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { GenerateContentBrief } from "../../../content-briefs/application/commands/generate-content-brief";
import {
  createAccountActiveSourcesContentBriefSourceScope,
  DEFAULT_CONTENT_BRIEF_SOURCE_SCOPE_LIMIT,
  serializeContentBriefSourceScope,
} from "../../../content-briefs/domain/content-brief-source-scope";
import type { WorkerJobsRepository } from "../../../execution/application/ports/worker-jobs-repository";
import type { AlertsRepository } from "../../../monitoring/application/ports/alerts-repository";
import { createAlert } from "../../../monitoring/domain/alert";
import type { RefreshTrends } from "../../../trends/application/commands/refresh-trends";
import type { TrendsRepository } from "../../../trends/application/ports/trends-repository";
import type { AccountSourceDocumentsReadModel } from "../../../sources/application/queries/list-account-source-documents";
import { computeNextRecurringRunAfter } from "../../../editorial/domain/recurring-schedule";
import type { SourceDocument } from "../../../sources/domain/source-document";
import type { AutopostPoliciesRepository } from "../ports/autopost-policies-repository";
import type { AutopostRunsRepository } from "../ports/autopost-runs-repository";
import { createAutopostAutomationContext } from "../../domain/autopost-automation-context";
import { createAutopostPolicy, type AutopostCadence } from "../../domain/autopost-policy";
import { createAutopostRun, markAutopostRunBriefGenerating } from "../../domain/autopost-run";
import { syncAutopostPolicyWorkerJob } from "../worker-job-sync";

export interface ExecuteAutopostPolicyDependencies {
  policies: AutopostPoliciesRepository;
  runs: AutopostRunsRepository;
  workerJobs: WorkerJobsRepository;
  sourceDocuments: AccountSourceDocumentsReadModel;
  trends: TrendsRepository;
  refreshTrends: RefreshTrends;
  generateContentBrief: GenerateContentBrief;
  auditLogs: AuditLogRepository;
  alerts: AlertsRepository;
  clock: Clock;
}

export class ExecuteAutopostPolicy {
  constructor(private readonly deps: ExecuteAutopostPolicyDependencies) {}

  async execute(input: {
    policy_id?: string;
    account_id?: string;
    trigger?: "manual" | "scheduled";
  }): Promise<AutopostRunNowResponse> {
    const policy = await this.resolvePolicy(input);
    const trigger = input.trigger ?? "scheduled";
    if (trigger === "scheduled" && policy.status !== "active") {
      throw new AppError("INVALID_STATE", "scheduled autopost execution requires an active policy", {
        details: { autopost_policy_id: policy.id, status: policy.status },
      });
    }

    const activeRun = await this.deps.runs.findActiveByPolicyId(policy.id);
    if (activeRun) {
      throw new AppError("INVALID_STATE", "autopost policy already has an active run", {
        details: { autopost_policy_id: policy.id, autopost_run_id: activeRun.id, status: activeRun.status },
      });
    }

    const now = this.deps.clock.now().toISOString();
    const scheduledFor = resolveScheduledFor(policy, trigger, now);
    const publishedFrom = new Date(Date.parse(now) - policy.content_strategy_body.max_source_age_days * 24 * 60 * 60 * 1000).toISOString();
    const sourceScope = createAccountActiveSourcesContentBriefSourceScope({
      source_types: policy.content_strategy_body.source_types,
      published_from: publishedFrom,
      published_to: now,
      limit: DEFAULT_CONTENT_BRIEF_SOURCE_SCOPE_LIMIT,
    });
    const scopeJson = serializeContentBriefSourceScope(sourceScope);
    const run = createAutopostRun({
      id: newId(),
      policy_id: policy.id,
      workspace_id: policy.workspace_id,
      account_id: policy.account_id,
      generation_mode: policy.content_strategy_body.generation_mode,
      source_scope: scopeJson,
      scheduled_for: scheduledFor,
      created_at: now,
      updated_at: now,
    });
    const nextPolicy = createAutopostPolicy({
      ...policy,
      next_run_after: policy.status === "active"
        ? computeNextRecurringRunAfter({
          cadence: policy.cadence_body,
          now,
          not_before: new Date(Date.parse(scheduledFor) + policy.cadence_body.min_spacing_minutes * 60_000).toISOString(),
        })
        : undefined,
      last_attempted_at: now,
      last_run_status: undefined,
      last_failed_at: undefined,
      last_error_code: undefined,
      last_error_message: undefined,
      last_enqueued_at: undefined,
      last_run_id: run.id,
      updated_at: now,
    });

    await this.deps.runs.save(run);
    await this.deps.policies.save(nextPolicy);
    await syncAutopostPolicyWorkerJob(this.deps.workerJobs, this.deps.clock, nextPolicy);

    try {
      const scopedDocuments = await this.loadScopedDocuments(policy.account_id, {
        source_types: sourceScope.source_types,
        published_from: sourceScope.published_from,
        published_to: sourceScope.published_to,
      });
      if (scopedDocuments.length === 0) {
        throw new AppError("NOT_FOUND", "autopost policy matched no source documents", {
          details: { autopost_policy_id: policy.id, account_id: policy.account_id },
        });
      }

      const trend = policy.content_strategy_body.generation_mode === "from_trend"
        ? await this.selectSupportedTrend(policy.workspace_id, scopedDocuments)
        : undefined;

      const response = await this.deps.generateContentBrief.execute({
        account_id: policy.account_id,
        trend_id: trend?.id,
        source_scope: sourceScope,
        automation: createAutopostAutomationContext({
          kind: "autopost",
          policy_id: policy.id,
          run_id: run.id,
        }),
      });

      const completedAt = this.deps.clock.now().toISOString();
      const nextRun = markAutopostRunBriefGenerating(run, {
        brief_id: response.brief_id,
        brief_task_id: response.task_id,
        trend_id: trend?.id,
        updated_at: completedAt,
      });
      const enqueuedPolicy = createAutopostPolicy({
        ...nextPolicy,
        last_enqueued_at: completedAt,
        updated_at: completedAt,
      });

      await this.deps.runs.save(nextRun);
      await this.deps.policies.save(enqueuedPolicy);
      await this.deps.auditLogs.append({
        id: newId(),
        workspace_id: policy.workspace_id,
        actor_type: "system",
        entity_type: "autopost_run",
        entity_id: nextRun.id,
        action: "autopost_run.enqueued",
        before_state: JSON.stringify(run),
        after_state: JSON.stringify(nextRun),
        created_at: completedAt,
      });

      return {
        policy: enqueuedPolicy,
        run: nextRun,
        task_id: response.task_id,
      };
    } catch (error) {
      const appError = error instanceof AppError
        ? error
        : new AppError("EXTERNAL_DEPENDENCY_ERROR", "autopost execution failed", { cause: error });
      const failedAt = this.deps.clock.now().toISOString();
      const failedRun = {
        ...run,
        status: "failed" as const,
        error_code: appError.code,
        error_message: appError.message,
        updated_at: failedAt,
        finished_at: failedAt,
      };
      const failedPolicy = createAutopostPolicy({
        ...nextPolicy,
        last_run_status: "failed",
        last_failed_at: failedAt,
        last_error_code: appError.code,
        last_error_message: appError.message,
        updated_at: failedAt,
      });

      await this.deps.runs.save(failedRun);
      await this.deps.policies.save(failedPolicy);
      await syncAutopostPolicyWorkerJob(this.deps.workerJobs, this.deps.clock, failedPolicy);
      await this.deps.auditLogs.append({
        id: newId(),
        workspace_id: policy.workspace_id,
        actor_type: "system",
        entity_type: "autopost_run",
        entity_id: failedRun.id,
        action: "autopost_run.failed",
        before_state: JSON.stringify(run),
        after_state: JSON.stringify(failedRun),
        created_at: failedAt,
      });
      await this.deps.alerts.create(createAlert({
        id: newId(),
        workspace_id: policy.workspace_id,
        severity: "warning",
        source_type: "runtime",
        source_id: failedRun.id,
        code: "autopost.run.failed",
        message: appError.message,
        payload: JSON.stringify({
          autopost_run_id: failedRun.id,
          autopost_policy_id: policy.id,
          error_code: appError.code,
        }),
        created_at: failedAt,
      }));
      throw appError;
    }
  }

  private async resolvePolicy(input: { policy_id?: string; account_id?: string }) {
    const hasPolicyId = typeof input.policy_id === "string" && input.policy_id.trim() !== "";
    const hasAccountId = typeof input.account_id === "string" && input.account_id.trim() !== "";
    if (Number(hasPolicyId) + Number(hasAccountId) !== 1) {
      throw new AppError("VALIDATION_ERROR", "autopost execution requires exactly one of policy_id or account_id");
    }

    const policy = hasPolicyId
      ? await this.deps.policies.findById(input.policy_id!)
      : await this.deps.policies.findByAccountId(input.account_id!);
    if (!policy) {
      throw new AppError("NOT_FOUND", "autopost policy not found", {
        details: { policy_id: input.policy_id, account_id: input.account_id },
      });
    }

    return policy;
  }

  private async loadScopedDocuments(accountId: string, input: {
    source_types: string[];
    published_from?: string;
    published_to?: string;
  }) {
    const result = await this.deps.sourceDocuments.listAccountSourceDocuments({
      account_id: accountId,
      source_types: input.source_types as Array<"rss" | "website" | "twitter" | "youtube" | "substack" | "telegram">,
      source_status: "active",
      published_from: input.published_from,
      published_to: input.published_to,
      limit: 120,
    });

    return result.documents.map((entry) => entry.document);
  }

  private async selectSupportedTrend(workspaceId: string, documents: SourceDocument[]) {
    await this.deps.refreshTrends.execute(workspaceId);
    const trends = (await this.deps.trends.listByWorkspaceId(workspaceId)).filter((trend) => trend.status === "active");
    const ranked = trends
      .map((trend) => ({
        trend,
        support_score: scoreTrendAgainstDocuments(trend.topic, documents),
      }))
      .filter((entry) => entry.support_score > 0)
      .sort((left, right) => {
        if (right.support_score !== left.support_score) {
          return right.support_score - left.support_score;
        }
        return right.trend.score - left.trend.score;
      });

    if (!ranked[0]) {
      throw new AppError("NOT_FOUND", "no trend is supported by the autopost source scope", {
        details: { workspace_id: workspaceId, document_count: documents.length },
      });
    }

    return ranked[0].trend;
  }
}

function resolveScheduledFor(
  policy: { cadence_body: AutopostCadence; next_run_after?: string },
  trigger: "manual" | "scheduled",
  now: string,
) {
  if (trigger === "scheduled") {
    return policy.next_run_after ?? computeNextRecurringRunAfter({
      cadence: policy.cadence_body,
      now,
    });
  }

  return computeNextRecurringRunAfter({
    cadence: policy.cadence_body,
    now,
    not_before: now,
  });
}

function normalizeTerms(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff\s]/g, " ")
    .split(/\s+/)
    .filter((term) => term.length >= 2);
}

function scoreTrendAgainstDocuments(topic: string, documents: SourceDocument[]) {
  const terms = normalizeTerms(topic);
  if (terms.length === 0) {
    return 0;
  }

  return documents.reduce((score, document) => {
    const haystack = `${document.title} ${document.summary} ${document.body_text}`.toLowerCase();
    const matches = terms.reduce((count, term) => haystack.includes(term) ? count + 1 : count, 0);
    if (matches === 0) {
      return score;
    }

    return score + matches * 10;
  }, 0);
}
