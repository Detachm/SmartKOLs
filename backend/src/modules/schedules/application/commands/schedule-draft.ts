import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { ScheduleDraftRequest, PublishScheduleResponse } from "../../../../contracts/api/schedules";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { DraftVersionRepository } from "../../../drafts/application/ports/draft-version-repository";
import type { DraftsRepository } from "../../../drafts/application/ports/drafts-repository";
import { assertXPostWithinLimit } from "../../../connector-x/domain/x-post-length";
import { createPublishSchedule } from "../../domain/publish-schedule";
import type { SchedulesRepository } from "../ports/schedules-repository";

export interface ScheduleDraftDependencies {
  drafts: DraftsRepository;
  versions: DraftVersionRepository;
  schedules: SchedulesRepository;
  auditLogs: AuditLogRepository;
  clock: Clock;
}

export class ScheduleDraft {
  constructor(private readonly deps: ScheduleDraftDependencies) {}

  async execute(draftId: string, input: ScheduleDraftRequest): Promise<PublishScheduleResponse> {
    const draft = await this.deps.drafts.findById(draftId);

    if (!draft) {
      throw new AppError("NOT_FOUND", "draft not found", {
        details: { draft_id: draftId },
      });
    }

    if (draft.status !== "approved") {
      throw new AppError("INVALID_STATE", "only approved drafts can be scheduled", {
        details: { draft_id: draftId, status: draft.status },
      });
    }
    if (!draft.current_version_id) {
      throw new AppError("INVALID_STATE", "approved draft must have a current version before scheduling", {
        details: { draft_id: draftId },
      });
    }
    const version = await this.deps.versions.findById(draft.current_version_id);
    if (!version) {
      throw new AppError("NOT_FOUND", "draft current version not found", {
        details: {
          draft_id: draft.id,
          version_id: draft.current_version_id,
        },
      });
    }

    assertXPostWithinLimit(version.content, {
      message: "draft content exceeds X weighted length limit and cannot be scheduled",
      details: {
        draft_id: draft.id,
        version_id: version.id,
      },
    });

    const now = this.deps.clock.now().toISOString();
    const schedule = createPublishSchedule({
      id: newId(),
      workspace_id: draft.workspace_id,
      account_id: draft.account_id,
      draft_id: draft.id,
      scheduled_for: input.scheduled_for,
      created_at: now,
    });

    const nextDraft = {
      ...draft,
      status: "scheduled" as const,
      scheduled_for: input.scheduled_for,
      updated_at: now,
    };

    await this.deps.schedules.createSchedule(schedule);
    await this.deps.drafts.save(nextDraft);
    await this.deps.auditLogs.append({
      id: newId(),
      workspace_id: draft.workspace_id,
      actor_type: "system",
      entity_type: "publish_schedule",
      entity_id: schedule.id,
      action: "publish_schedule.created",
      after_state: JSON.stringify(schedule),
      created_at: now,
    });

    return schedule;
  }
}
