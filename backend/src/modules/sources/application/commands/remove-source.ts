import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { SourcesRepository } from "../ports/sources-repository";

export interface RemoveSourceDependencies {
  sources: SourcesRepository;
  auditLogs: AuditLogRepository;
  clock: Clock;
}

export class RemoveSource {
  constructor(private readonly deps: RemoveSourceDependencies) {}

  async execute(sourceId: string) {
    const source = await this.deps.sources.findSourceById(sourceId);
    if (!source) {
      throw new AppError("NOT_FOUND", "source not found", {
        details: { source_id: sourceId },
      });
    }

    await this.deps.sources.deleteSource(sourceId);
    await this.deps.auditLogs.append({
      id: newId(),
      workspace_id: source.workspace_id,
      actor_type: "user",
      entity_type: "source",
      entity_id: source.id,
      action: "source.deleted",
      before_state: JSON.stringify(source),
      created_at: this.deps.clock.now().toISOString(),
    });
  }
}
