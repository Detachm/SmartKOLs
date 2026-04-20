import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { SourcesRepository } from "../ports/sources-repository";
import { resumeSource } from "../../domain/source";

export interface ResumeSourceDependencies {
  sources: SourcesRepository;
  auditLogs: AuditLogRepository;
  clock: Clock;
}

export class ResumeSource {
  constructor(private readonly deps: ResumeSourceDependencies) {}

  async execute(sourceId: string) {
    const source = await this.deps.sources.findSourceById(sourceId);
    if (!source) {
      throw new AppError("NOT_FOUND", "source not found", {
        details: { source_id: sourceId },
      });
    }

    const resumed = resumeSource(source);
    await this.deps.sources.saveSource(resumed);
    await this.deps.auditLogs.append({
      id: newId(),
      workspace_id: resumed.workspace_id,
      actor_type: "user",
      entity_type: "source",
      entity_id: resumed.id,
      action: "source.resumed",
      before_state: JSON.stringify(source),
      after_state: JSON.stringify(resumed),
      created_at: this.deps.clock.now().toISOString(),
    });

    return resumed;
  }
}
