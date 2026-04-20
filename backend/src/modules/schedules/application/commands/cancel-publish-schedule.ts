import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { PublishScheduleResponse } from "../../../../contracts/api/schedules";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { DraftsRepository } from "../../../drafts/application/ports/drafts-repository";
import { cancelPendingSchedule } from "../../domain/publish-schedule";
import type { SchedulesRepository } from "../ports/schedules-repository";

export interface CancelPublishScheduleDependencies {
  schedules: SchedulesRepository;
  drafts: DraftsRepository;
  auditLogs: AuditLogRepository;
  clock: Clock;
}

export class CancelPublishSchedule {
  constructor(private readonly deps: CancelPublishScheduleDependencies) {}

  async execute(scheduleId: string): Promise<PublishScheduleResponse> {
    const existing = await this.deps.schedules.findScheduleById(scheduleId);
    if (!existing) {
      throw new AppError("NOT_FOUND", "publish schedule not found", {
        details: { schedule_id: scheduleId },
      });
    }

    const latestJob = await this.deps.schedules.findLatestPublishJobByScheduleId(scheduleId);
    if (latestJob && ["queued", "running"].includes(latestJob.status)) {
      throw new AppError("INVALID_STATE", "queued or running publish job must be handled before cancelling schedule", {
        details: { schedule_id: scheduleId, publish_job_id: latestJob.id, publish_job_status: latestJob.status },
      });
    }

    const draft = await this.deps.drafts.findById(existing.draft_id);
    if (!draft) {
      throw new AppError("NOT_FOUND", "draft not found for schedule cancellation", {
        details: { draft_id: existing.draft_id, schedule_id: scheduleId },
      });
    }

    const nextSchedule = cancelPendingSchedule(existing);
    const now = this.deps.clock.now().toISOString();
    const nextDraft = {
      ...draft,
      status: "approved" as const,
      scheduled_for: undefined,
      updated_at: now,
    };

    await this.deps.schedules.saveSchedule(nextSchedule);
    await this.deps.drafts.save(nextDraft);
    await this.deps.auditLogs.append({
      id: newId(),
      workspace_id: existing.workspace_id,
      actor_type: "system",
      entity_type: "publish_schedule",
      entity_id: existing.id,
      action: "publish_schedule.cancelled",
      before_state: JSON.stringify(existing),
      after_state: JSON.stringify(nextSchedule),
      created_at: now,
    });

    return nextSchedule;
  }
}
