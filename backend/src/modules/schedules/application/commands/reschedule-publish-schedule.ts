import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { UpdatePublishScheduleRequest, PublishScheduleResponse } from "../../../../contracts/api/schedules";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { DraftsRepository } from "../../../drafts/application/ports/drafts-repository";
import { reschedulePendingSchedule } from "../../domain/publish-schedule";
import type { SchedulesRepository } from "../ports/schedules-repository";

export interface ReschedulePublishScheduleDependencies {
  schedules: SchedulesRepository;
  drafts: DraftsRepository;
  auditLogs: AuditLogRepository;
  clock: Clock;
}

export class ReschedulePublishSchedule {
  constructor(private readonly deps: ReschedulePublishScheduleDependencies) {}

  async execute(scheduleId: string, input: UpdatePublishScheduleRequest): Promise<PublishScheduleResponse> {
    const existing = await this.deps.schedules.findScheduleById(scheduleId);
    if (!existing) {
      throw new AppError("NOT_FOUND", "publish schedule not found", {
        details: { schedule_id: scheduleId },
      });
    }

    const draft = await this.deps.drafts.findById(existing.draft_id);
    if (!draft) {
      throw new AppError("NOT_FOUND", "draft not found for schedule update", {
        details: { draft_id: existing.draft_id, schedule_id: scheduleId },
      });
    }

    const nextSchedule = reschedulePendingSchedule(existing, input.scheduled_for);
    const now = this.deps.clock.now().toISOString();
    const nextDraft = {
      ...draft,
      status: "scheduled" as const,
      scheduled_for: input.scheduled_for,
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
      action: "publish_schedule.rescheduled",
      before_state: JSON.stringify(existing),
      after_state: JSON.stringify(nextSchedule),
      created_at: now,
    });

    return nextSchedule;
  }
}
