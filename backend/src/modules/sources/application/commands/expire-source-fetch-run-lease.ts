import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { AlertsRepository } from "../../../monitoring/application/ports/alerts-repository";
import { createAlert } from "../../../monitoring/domain/alert";
import type { SourcesRepository } from "../ports/sources-repository";
import { markSourceFetchRunFailed } from "../../domain/source-fetch-run";

export interface ExpireSourceFetchRunLeaseDependencies {
  sources: SourcesRepository;
  auditLogs: AuditLogRepository;
  alerts: AlertsRepository;
  clock: Clock;
}

export class ExpireSourceFetchRunLease {
  constructor(private readonly deps: ExpireSourceFetchRunLeaseDependencies) {}

  async execute(runId: string) {
    const run = await this.deps.sources.findFetchRunById(runId);
    if (!run) {
      throw new AppError("NOT_FOUND", "source fetch run not found", {
        details: { source_fetch_run_id: runId },
      });
    }

    if (run.status !== "running") {
      throw new AppError("INVALID_STATE", "source fetch run lease can only expire from running state", {
        details: { source_fetch_run_id: run.id, status: run.status },
      });
    }

    const source = await this.deps.sources.findSourceById(run.source_id);
    if (!source) {
      throw new AppError("NOT_FOUND", "source not found", {
        details: { source_id: run.source_id, source_fetch_run_id: run.id },
      });
    }

    const finishedAt = this.deps.clock.now().toISOString();
    const nextRun = markSourceFetchRunFailed(run, finishedAt, "LEASE_EXPIRED", "source fetch worker lease expired");
    await this.deps.sources.saveFetchRun(nextRun);
    await this.deps.auditLogs.append({
      id: newId(),
      workspace_id: source.workspace_id,
      actor_type: "system",
      entity_type: "source_fetch_run",
      entity_id: run.id,
      action: "source_fetch_run.lease_expired",
      before_state: JSON.stringify(run),
      after_state: JSON.stringify(nextRun),
      created_at: finishedAt,
    });
    await this.deps.alerts.create(createAlert({
      id: newId(),
      workspace_id: source.workspace_id,
      severity: "warning",
      source_type: "connector",
      source_id: run.id,
      code: "source.fetch.lease_expired",
      message: "source fetch worker lease expired",
      payload: JSON.stringify({ source_id: source.id, source_fetch_run_id: run.id }),
      created_at: finishedAt,
    }));

    return nextRun;
  }
}
