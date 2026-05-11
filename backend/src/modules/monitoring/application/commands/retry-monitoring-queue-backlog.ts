import { requireIntegerInRange, requireNonEmptyString, requireOneOf } from "../../../../core/validation/guards";
import type {
  MonitoringOperatorQueueKind,
  RetryMonitoringQueueBacklogAttempt,
  RetryMonitoringQueueBacklogKindResult,
  RetryMonitoringQueueBacklogResponse,
} from "../../../../contracts/api/monitoring";
import type { RetryAgentTask } from "../../../agent-runtime/application/commands/retry-agent-task";
import type { RetryWorkerJob } from "../../../execution/application/commands/retry-worker-job";
import type { RetryPublishJob } from "../../../schedules/application/commands/retry-publish-job";
import type { RetrySourceFetchRun } from "../../../sources/application/commands/retry-source-fetch-run";
import { AppError } from "../../../../core/errors/app-error";
import type { MonitoringOperatorQueueReadModel } from "../queries/get-monitoring-overview";

type RetryableMonitoringOperatorQueueKind = Exclude<MonitoringOperatorQueueKind, "account_readiness" | "draft_review" | "reply_review" | "runtime_health">;

const ALL_QUEUE_KINDS: MonitoringOperatorQueueKind[] = [
  "account_readiness",
  "draft_review",
  "reply_review",
  "runtime_health",
  "agent_task",
  "worker_job",
  "publish_job",
  "source_fetch_run",
];
const RETRYABLE_QUEUE_KINDS: RetryableMonitoringOperatorQueueKind[] = ["agent_task", "worker_job", "publish_job", "source_fetch_run"];

export interface RetryMonitoringQueueBacklogDependencies {
  operatorQueues: MonitoringOperatorQueueReadModel;
  retryAgentTask: RetryAgentTask;
  retryWorkerJob: RetryWorkerJob;
  retryPublishJob: RetryPublishJob;
  retrySourceFetchRun: RetrySourceFetchRun;
}

export interface RetryMonitoringQueueBacklogInput {
  workspace_id: string;
  kinds?: MonitoringOperatorQueueKind[];
  limit?: number;
  retry_mode?: "safe" | "all";
}

export class RetryMonitoringQueueBacklog {
  constructor(private readonly deps: RetryMonitoringQueueBacklogDependencies) {}

  async execute(input: RetryMonitoringQueueBacklogInput): Promise<RetryMonitoringQueueBacklogResponse> {
    const workspaceId = requireNonEmptyString(input.workspace_id, "workspace_id");
    const requestedKinds = normalizeKinds(input.kinds).filter(isRetryableQueueKind);
    const limit = requireIntegerInRange(input.limit ?? 100, "limit", 1, 200);
    const retryMode = input.retry_mode
      ? requireOneOf(input.retry_mode, "retry_mode", ["safe", "all"] as const)
      : "safe";

    const attempts: RetryMonitoringQueueBacklogAttempt[] = [];
    const kindResults = new Map<MonitoringOperatorQueueKind, RetryMonitoringQueueBacklogKindResult>();
    let remaining = limit;

    for (const kind of requestedKinds) {
      if (remaining <= 0) {
        kindResults.set(kind, {
          kind,
          matched_failed_count: 0,
          retried_count: 0,
          failed_count: 0,
          skipped_count: 0,
        });
        continue;
      }

      const nextAttempts = await this.retryKind(workspaceId, kind, remaining, retryMode);
      attempts.push(...nextAttempts);
      remaining -= nextAttempts.filter((attempt) => attempt.status !== "skipped").length;
      kindResults.set(kind, summarizeKindAttempts(kind, nextAttempts));
    }

    return {
      workspace_id: workspaceId,
      requested_kinds: requestedKinds,
      limit,
      summary: {
        matched_failed_items: attempts.length,
        retried_items: attempts.filter((item) => item.status === "retried").length,
        failed_items: attempts.filter((item) => item.status === "failed").length,
        skipped_items: attempts.filter((item) => item.status === "skipped").length,
      },
      kinds: requestedKinds.map((kind) => {
        return kindResults.get(kind) ?? {
          kind,
          matched_failed_count: 0,
          retried_count: 0,
          failed_count: 0,
          skipped_count: 0,
        };
      }),
      attempts,
    };
  }

  private async retryKind(
    workspaceId: string,
    kind: RetryableMonitoringOperatorQueueKind,
    limit: number,
    retryMode: "safe" | "all",
  ): Promise<RetryMonitoringQueueBacklogAttempt[]> {
    switch (kind) {
      case "agent_task": {
        const tasks = await this.deps.operatorQueues.listRetryableFailedByWorkspaceId(workspaceId, kind, limit);
        return Promise.all(tasks.map(async (task) => {
          const skipped = maybeSkipUnsafeRetry(kind, task, retryMode);
          if (skipped) {
            return skipped;
          }
          try {
            const result = await this.deps.retryAgentTask.execute(task.id);
            return {
              kind,
              source_id: task.id,
              retried_id: result.task_id,
              status: "retried" as const,
            };
          } catch (error) {
            return mapRetryError(kind, task.id, error);
          }
        }));
      }
      case "worker_job": {
        const jobs = await this.deps.operatorQueues.listRetryableFailedByWorkspaceId(workspaceId, kind, limit);
        return Promise.all(jobs.map(async (job) => {
          const skipped = maybeSkipUnsafeRetry(kind, job, retryMode);
          if (skipped) {
            return skipped;
          }
          try {
            const result = await this.deps.retryWorkerJob.execute(job.id);
            return {
              kind,
              source_id: job.id,
              retried_id: result.id,
              status: "retried" as const,
            };
          } catch (error) {
            return mapRetryError(kind, job.id, error);
          }
        }));
      }
      case "publish_job": {
        const jobs = await this.deps.operatorQueues.listRetryableFailedByWorkspaceId(workspaceId, kind, limit);
        return Promise.all(jobs.map(async (job) => {
          const skipped = maybeSkipUnsafeRetry(kind, job, retryMode);
          if (skipped) {
            return skipped;
          }
          try {
            const result = await this.deps.retryPublishJob.execute(job.id);
            return {
              kind,
              source_id: job.id,
              retried_id: result.id,
              status: "retried" as const,
            };
          } catch (error) {
            return mapRetryError(kind, job.id, error);
          }
        }));
      }
      case "source_fetch_run": {
        const runs = await this.deps.operatorQueues.listRetryableFailedByWorkspaceId(workspaceId, kind, limit);
        return Promise.all(runs.map(async (run) => {
          const skipped = maybeSkipUnsafeRetry(kind, run, retryMode);
          if (skipped) {
            return skipped;
          }
          try {
            const result = await this.deps.retrySourceFetchRun.execute(run.id);
            return {
              kind,
              source_id: run.id,
              retried_id: result.run_id,
              status: "retried" as const,
            };
          } catch (error) {
            return mapRetryError(kind, run.id, error);
          }
        }));
      }
    }
  }
}

function maybeSkipUnsafeRetry(
  kind: MonitoringOperatorQueueKind,
  item: {
    id: string;
    auto_retry_recommended?: boolean;
    error_category?: string;
    retry_advice?: string;
  },
  retryMode: "safe" | "all",
): RetryMonitoringQueueBacklogAttempt | undefined {
  if (retryMode === "all" || item.auto_retry_recommended === true) {
    return undefined;
  }

  return {
    kind,
    source_id: item.id,
    status: "skipped",
    error_code: item.error_category,
    error_message: item.retry_advice,
    skip_reason: "safe mode only retries temporary, rate-limited, or worker-interrupted items",
  };
}

function isRetryableQueueKind(kind: MonitoringOperatorQueueKind): kind is RetryableMonitoringOperatorQueueKind {
  return RETRYABLE_QUEUE_KINDS.includes(kind as RetryableMonitoringOperatorQueueKind);
}

function normalizeKinds(kinds: MonitoringOperatorQueueKind[] | undefined): MonitoringOperatorQueueKind[] {
  if (!kinds || kinds.length === 0) {
    return [...ALL_QUEUE_KINDS];
  }

  const deduped = new Set<MonitoringOperatorQueueKind>();
  for (const kind of kinds) {
    deduped.add(requireOneOf(kind, "kind", ALL_QUEUE_KINDS));
  }

  return ALL_QUEUE_KINDS.filter((kind) => deduped.has(kind));
}

function summarizeKindAttempts(
  kind: MonitoringOperatorQueueKind,
  attempts: RetryMonitoringQueueBacklogAttempt[],
): RetryMonitoringQueueBacklogKindResult {
  return {
    kind,
    matched_failed_count: attempts.length,
    retried_count: attempts.filter((item) => item.status === "retried").length,
    failed_count: attempts.filter((item) => item.status === "failed").length,
    skipped_count: attempts.filter((item) => item.status === "skipped").length,
  };
}

function mapRetryError(kind: MonitoringOperatorQueueKind, sourceId: string, error: unknown): RetryMonitoringQueueBacklogAttempt {
  if (error instanceof AppError) {
    return {
      kind,
      source_id: sourceId,
      status: "failed",
      error_code: error.code,
      error_message: error.message,
    };
  }

  throw error;
}
