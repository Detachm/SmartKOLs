import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { ContentBriefResponse } from "../../../../contracts/api/content-briefs";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { ContentBriefsRepository } from "../ports/content-briefs-repository";
import { mapContentBriefResponse } from "../content-brief-response";
import { archiveContentBrief } from "../../domain/content-brief";

export interface ArchiveContentBriefDependencies {
  contentBriefs: ContentBriefsRepository;
  auditLogs: AuditLogRepository;
  now: () => string;
}

export class ArchiveContentBrief {
  constructor(private readonly deps: ArchiveContentBriefDependencies) {}

  async execute(briefId: string): Promise<ContentBriefResponse> {
    const brief = await this.deps.contentBriefs.findBriefById(briefId);
    if (!brief) {
      throw new AppError("NOT_FOUND", "content brief not found", {
        details: { brief_id: briefId },
      });
    }

    const archived = archiveContentBrief(brief, this.deps.now());
    await this.deps.contentBriefs.saveBrief(archived);
    await this.deps.auditLogs.append({
      id: newId(),
      workspace_id: archived.workspace_id,
      actor_type: "user",
      entity_type: "content_brief",
      entity_id: archived.id,
      action: "content_brief.archived",
      before_state: JSON.stringify(brief),
      after_state: JSON.stringify(archived),
      created_at: archived.updated_at,
    });

    return mapContentBriefResponse(archived);
  }
}
