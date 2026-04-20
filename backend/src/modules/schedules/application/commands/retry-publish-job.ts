import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { DraftsRepository } from "../../../drafts/application/ports/drafts-repository";
import { createPublishJob } from "../../domain/publish-job";
import { retryFailedSchedule } from "../../domain/publish-schedule";
import type { SchedulesRepository } from "../ports/schedules-repository";

export interface RetryPublishJobDependencies {
  schedules: SchedulesRepository;
  drafts: DraftsRepository;
  auditLogs: AuditLogRepository;
  clock: Clock;
}

export class RetryPublishJob {
  constructor(private readonly deps: RetryPublishJobDependencies) {}

  async execute(publishJobId: string) {
    const previousJob = await this.deps.schedules.findPublishJobById(publishJobId);
    if (!previousJob) {
      throw new AppError("NOT_FOUND", "publish job not found", {
        details: { publish_job_id: publishJobId },
      });
    }

    if (previousJob.status !== "failed") {
      throw new AppError("INVALID_STATE", "publish job can only be retried from failed state", {
        details: { publish_job_id: previousJob.id, status: previousJob.status },
      });
    }

    const schedule = await this.deps.schedules.findScheduleById(previousJob.schedule_id);
    if (!schedule) {
      throw new AppError("NOT_FOUND", "publish schedule not found", {
        details: { schedule_id: previousJob.schedule_id },
      });
    }

    const queuedAt = this.deps.clock.now().toISOString();
    const nextSchedule = retryFailedSchedule(schedule);
    const nextJob = createPublishJob({
      id: newId(),
      schedule_id: schedule.id,
      idempotency_key: `${previousJob.idempotency_key}:retry:${queuedAt}`,
      run_after: queuedAt,
    });
    const draft = await this.deps.drafts.findById(schedule.draft_id);
    if (!draft) {
      throw new AppError("NOT_FOUND", "draft not found for publish retry", {
        details: { draft_id: schedule.draft_id, schedule_id: schedule.id },
      });
    }
    const nextDraft = {
      ...draft,
      status: "scheduled" as const,
      scheduled_for: schedule.scheduled_for,
      updated_at: queuedAt,
    };

    await this.deps.schedules.saveSchedule(nextSchedule);
    await this.deps.schedules.createPublishJob(nextJob);
    await this.deps.drafts.save(nextDraft);
    await this.deps.auditLogs.append({
      id: newId(),
      workspace_id: schedule.workspace_id,
      actor_type: "system",
      entity_type: "publish_job",
      entity_id: nextJob.id,
      action: "publish_job.requeued",
      before_state: JSON.stringify(previousJob),
      after_state: JSON.stringify(nextJob),
      created_at: queuedAt,
    });

    return nextJob;
  }
}
