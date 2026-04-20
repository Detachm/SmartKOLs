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

const ALL_QUEUE_KINDS: MonitoringOperatorQueueKind[] = ["agent_task", "worker_job", "publish_job", "source_fetch_run"];

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
}

export class RetryMonitoringQueueBacklog {
  constructor(private readonly deps: RetryMonitoringQueueBacklogDependencies) {}

  async execute(input: RetryMonitoringQueueBacklogInput): Promise<RetryMonitoringQueueBacklogResponse> {
    const workspaceId = requireNonEmptyString(input.workspace_id, "workspace_id");
    const requestedKinds = normalizeKinds(input.kinds);
    const limit = requireIntegerInRange(input.limit ?? 100, "limit", 1, 200);

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
        });
        continue;
      }

      const nextAttempts = await this.retryKind(workspaceId, kind, remaining);
      attempts.push(...nextAttempts);
      remaining -= nextAttempts.length;
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
      },
      kinds: requestedKinds.map((kind) => {
        return kindResults.get(kind) ?? {
          kind,
          matched_failed_count: 0,
          retried_count: 0,
          failed_count: 0,
        };
      }),
      attempts,
    };
  }

  private async retryKind(
    workspaceId: string,
    kind: MonitoringOperatorQueueKind,
    limit: number,
  ): Promise<RetryMonitoringQueueBacklogAttempt[]> {
    switch (kind) {
      case "agent_task": {
        const tasks = await this.deps.operatorQueues.listRetryableFailedByWorkspaceId(workspaceId, kind, limit);
        return Promise.all(tasks.map(async (task) => {
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
