import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import { markPublishJobSucceeded } from "../../domain/publish-job";
import { markSchedulePublished } from "../../domain/publish-schedule";
import type { SchedulesRepository } from "../ports/schedules-repository";

export interface MarkPublishSucceededDependencies {
  schedules: SchedulesRepository;
  auditLogs: AuditLogRepository;
  clock: Clock;
}

export class MarkPublishSucceeded {
  constructor(private readonly deps: MarkPublishSucceededDependencies) {}

  async execute(publishJobId: string) {
    const job = await this.deps.schedules.findPublishJobById(publishJobId);
    if (!job) {
      throw new AppError("NOT_FOUND", "publish job not found", {
        details: { publish_job_id: publishJobId },
      });
    }

    const schedule = await this.deps.schedules.findScheduleById(job.schedule_id);
    if (!schedule) {
      throw new AppError("NOT_FOUND", "publish schedule not found", {
        details: { schedule_id: job.schedule_id },
      });
    }

    const now = this.deps.clock.now().toISOString();
    const nextJob = markPublishJobSucceeded(job, now);
    const nextSchedule = markSchedulePublished(schedule);

    await this.deps.schedules.savePublishJob(nextJob);
    await this.deps.schedules.saveSchedule(nextSchedule);
    await this.deps.auditLogs.append({
      id: newId(),
      workspace_id: schedule.workspace_id,
      actor_type: "system",
      entity_type: "publish_job",
      entity_id: nextJob.id,
      action: "publish_job.succeeded",
      before_state: JSON.stringify(job),
      after_state: JSON.stringify(nextJob),
      created_at: now,
    });

    return nextJob;
  }
}
