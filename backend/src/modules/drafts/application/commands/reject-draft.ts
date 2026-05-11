import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { QueueAccountAutomationTick } from "../../../orchestration/application/commands/queue-account-automation-tick";
import { createDraftReview, rejectDraftState } from "../../domain/draft";
import type { DraftsRepository } from "../ports/drafts-repository";

export interface RejectDraftRequest {
  reviewer_type: "user" | "agent";
  reviewer_id?: string;
  comment?: string;
}

export interface RejectDraftDependencies {
  drafts: DraftsRepository;
  auditLogs: AuditLogRepository;
  queueAccountAutomationTick: QueueAccountAutomationTick;
  clock: Clock;
}

export class RejectDraft {
  constructor(private readonly deps: RejectDraftDependencies) {}

  async execute(draftId: string, input: RejectDraftRequest) {
    const existing = await this.deps.drafts.findById(draftId);

    if (!existing) {
      throw new AppError("NOT_FOUND", "draft not found", {
        details: { draft_id: draftId },
      });
    }

    const now = this.deps.clock.now().toISOString();
    const next = rejectDraftState(existing, now);
    const review = createDraftReview({
      id: newId(),
      draft_id: draftId,
      reviewer_type: input.reviewer_type,
      reviewer_id: input.reviewer_id,
      action: "reject",
      comment: input.comment,
      created_at: now,
    });

    await this.deps.drafts.save(next);
    await this.deps.drafts.appendReview(review);
    await this.deps.auditLogs.append({
      id: newId(),
      workspace_id: next.workspace_id,
      actor_type: input.reviewer_type,
      actor_id: input.reviewer_id,
      entity_type: "draft",
      entity_id: next.id,
      action: "draft.rejected",
      before_state: JSON.stringify(existing),
      after_state: JSON.stringify(next),
      created_at: now,
    });
    await this.deps.queueAccountAutomationTick.execute({
      account_id: next.account_id,
      trigger_kind: "draft_review_follow_up",
      create_if_missing: false,
    });

    return next;
  }
}
