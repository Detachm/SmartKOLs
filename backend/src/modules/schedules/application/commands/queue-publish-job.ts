import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import { requireNonEmptyString } from "../../../../core/validation/guards";
import type { Clock } from "../../../../core/time/clock";
import type { PublishJobResponse } from "../../../../contracts/api/schedules";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import { createPublishJob } from "../../domain/publish-job";
import { markScheduleQueued } from "../../domain/publish-schedule";
import type { SchedulesRepository } from "../ports/schedules-repository";

export interface QueuePublishJobDependencies {
  schedules: SchedulesRepository;
  auditLogs: AuditLogRepository;
  clock: Clock;
}

export class QueuePublishJob {
  constructor(private readonly deps: QueuePublishJobDependencies) {}

  async execute(scheduleId: string): Promise<PublishJobResponse> {
    const schedule = await this.deps.schedules.findScheduleById(scheduleId);

    if (!schedule) {
      throw new AppError("NOT_FOUND", "publish schedule not found", {
        details: { schedule_id: scheduleId },
      });
    }

    const now = this.deps.clock.now().toISOString();
    const queuedSchedule = markScheduleQueued(schedule);
    const job = createPublishJob({
      id: newId(),
      schedule_id: schedule.id,
      idempotency_key: requireNonEmptyString(`${schedule.account_id}:${schedule.id}:${schedule.scheduled_for}`, "idempotency_key"),
      run_after: schedule.scheduled_for,
    });

    await this.deps.schedules.saveSchedule(queuedSchedule);
    await this.deps.schedules.createPublishJob(job);
    await this.deps.auditLogs.append({
      id: newId(),
      workspace_id: schedule.workspace_id,
      actor_type: "system",
      entity_type: "publish_job",
      entity_id: job.id,
      action: "publish_job.queued",
      after_state: JSON.stringify(job),
      created_at: now,
    });

    return job;
  }
}
