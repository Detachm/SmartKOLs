import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { SourcesRepository } from "../ports/sources-repository";
import { createSourceFetchRun } from "../../domain/source-fetch-run";

export interface FetchSourceDependencies {
  sources: SourcesRepository;
  auditLogs: AuditLogRepository;
  clock: Clock;
}

export class FetchSource {
  constructor(private readonly deps: FetchSourceDependencies) {}

  async execute(sourceId: string) {
    const source = await this.deps.sources.findSourceById(sourceId);
    if (!source) {
      throw new AppError("NOT_FOUND", "source not found", {
        details: { source_id: sourceId },
      });
    }

    if (source.status !== "active") {
      throw new AppError("INVALID_STATE", "source must be active before it can be fetched", {
        details: { source_id: source.id, status: source.status },
      });
    }

    const queuedAt = this.deps.clock.now().toISOString();
    const run = createSourceFetchRun({
      id: newId(),
      source_id: source.id,
      status: "queued",
      fetched_count: 0,
      started_at: queuedAt,
    });

    await this.deps.sources.createFetchRun(run);
    await this.deps.auditLogs.append({
      id: newId(),
      workspace_id: source.workspace_id,
      actor_type: "system",
      entity_type: "source_fetch_run",
      entity_id: run.id,
      action: "source.fetch_queued",
      after_state: JSON.stringify(run),
      created_at: queuedAt,
    });

    return {
      run_id: run.id,
      status: run.status,
    };
  }
}
