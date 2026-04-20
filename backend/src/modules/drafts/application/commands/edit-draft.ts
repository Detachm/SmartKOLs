import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import { requireNonEmptyString } from "../../../../core/validation/guards";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import { createDraftReview, editDraftContent } from "../../domain/draft";
import { createDraftVersion, type DraftVersion } from "../../domain/draft-version";
import type { DraftVersionRepository } from "../ports/draft-version-repository";
import type { DraftsRepository } from "../ports/drafts-repository";

export interface EditDraftRequest {
  editor_type: "user" | "agent";
  editor_id?: string;
  content: string;
  metadata?: string;
  comment?: string;
}

export interface EditDraftDependencies {
  drafts: DraftsRepository;
  versions: DraftVersionRepository;
  auditLogs: AuditLogRepository;
  clock: Clock;
}

export class EditDraft {
  constructor(private readonly deps: EditDraftDependencies) {}

  async execute(draftId: string, input: EditDraftRequest) {
    const existing = await this.deps.drafts.findById(draftId);

    if (!existing) {
      throw new AppError("NOT_FOUND", "draft not found", {
        details: { draft_id: draftId },
      });
    }

    const now = this.deps.clock.now().toISOString();
    const nextVersionNo = await this.deps.versions.getNextVersionNumber(draftId);
    const version = createDraftVersion({
      id: newId(),
      draft_id: draftId,
      version_no: nextVersionNo,
      content: requireNonEmptyString(input.content, "content"),
      metadata: input.metadata?.trim() || "{}",
      created_by_type: input.editor_type,
      created_by_id: input.editor_id,
      created_at: now,
    });

    const next = {
      ...editDraftContent(existing, now),
      current_version_id: version.id,
    };

    const review = createDraftReview({
      id: newId(),
      draft_id: draftId,
      reviewer_type: input.editor_type,
      reviewer_id: input.editor_id,
      action: "edit",
      comment: input.comment,
      created_at: now,
    });

    await this.deps.versions.create(version);
    await this.deps.drafts.save(next);
    await this.deps.drafts.appendReview(review);
    await this.deps.auditLogs.append({
      id: newId(),
      workspace_id: next.workspace_id,
      actor_type: input.editor_type,
      actor_id: input.editor_id,
      entity_type: "draft",
      entity_id: next.id,
      action: "draft.edited",
      before_state: JSON.stringify(existing),
      after_state: JSON.stringify(next),
      created_at: now,
    });

    return next;
  }
}
