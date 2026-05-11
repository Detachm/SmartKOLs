import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { SourcesRepository } from "../ports/sources-repository";
import { createSourceFetchRun } from "../../domain/source-fetch-run";

export interface RetrySourceFetchRunDependencies {
  sources: SourcesRepository;
  auditLogs: AuditLogRepository;
  clock: Clock;
}

export class RetrySourceFetchRun {
  constructor(private readonly deps: RetrySourceFetchRunDependencies) {}

  async execute(runId: string) {
    const previousRun = await this.deps.sources.findFetchRunById(runId);
    if (!previousRun) {
      throw new AppError("NOT_FOUND", "source fetch run not found", {
        details: { source_fetch_run_id: runId },
      });
    }

    if (previousRun.status !== "failed") {
      throw new AppError("INVALID_STATE", "source fetch run can only be retried from failed state", {
        details: { source_fetch_run_id: previousRun.id, status: previousRun.status },
      });
    }

    const source = await this.deps.sources.findSourceById(previousRun.source_id);
    if (!source) {
      throw new AppError("NOT_FOUND", "source not found", {
        details: { source_id: previousRun.source_id, source_fetch_run_id: previousRun.id },
      });
    }

    if (source.status !== "active") {
      throw new AppError("INVALID_STATE", "source must be active before a failed fetch run can be retried", {
        details: { source_id: source.id, status: source.status, source_fetch_run_id: previousRun.id },
      });
    }

    const queuedAt = this.deps.clock.now().toISOString();
    const nextRun = createSourceFetchRun({
      id: newId(),
      source_id: previousRun.source_id,
      status: "queued",
      fetched_count: 0,
      started_at: queuedAt,
    });

    await this.deps.sources.createFetchRun(nextRun);
    await this.deps.auditLogs.append({
      id: newId(),
      workspace_id: source.workspace_id,
      actor_type: "system",
      entity_type: "source_fetch_run",
      entity_id: nextRun.id,
      action: "source.fetch_requeued",
      before_state: JSON.stringify(previousRun),
      after_state: JSON.stringify(nextRun),
      created_at: queuedAt,
    });

    return {
      run_id: nextRun.id,
      status: nextRun.status,
    };
  }
}
