import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import { markDraftPublishFailed } from "../../../drafts/domain/draft";
import type { DraftsRepository } from "../../../drafts/application/ports/drafts-repository";
import { createAlert } from "../../../monitoring/domain/alert";
import { markPublishJobFailed } from "../../domain/publish-job";
import { markScheduleFailed } from "../../domain/publish-schedule";
import type { PublishWriteTransaction } from "../ports/publish-write-transaction";
import type { SchedulesRepository } from "../ports/schedules-repository";

export interface MarkPublishFailedDependencies {
  schedules: SchedulesRepository;
  drafts: DraftsRepository;
  publishWrites: PublishWriteTransaction;
  clock: Clock;
}

export class MarkPublishFailed {
  constructor(private readonly deps: MarkPublishFailedDependencies) {}

  async execute(publishJobId: string, errorCode: string, errorMessage: string) {
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

    const draft = await this.deps.drafts.findById(schedule.draft_id);
    if (!draft) {
      throw new AppError("NOT_FOUND", "draft not found for publish failure", {
        details: { draft_id: schedule.draft_id },
      });
    }

    const now = this.deps.clock.now().toISOString();
    const nextJob = markPublishJobFailed(job, now, errorCode, errorMessage);
    const nextSchedule = markScheduleFailed(schedule);
    const nextDraft = draft.status === "failed"
      ? {
        ...draft,
        updated_at: now,
      }
      : markDraftPublishFailed(draft, now);

    await this.deps.publishWrites.commitPublishFailure({
      next_job: nextJob,
      next_schedule: nextSchedule,
      next_draft: nextDraft,
      audit_log: {
        id: newId(),
        workspace_id: schedule.workspace_id,
        actor_type: "system",
        entity_type: "publish_job",
        entity_id: nextJob.id,
        action: "publish_job.failed",
        before_state: JSON.stringify(job),
        after_state: JSON.stringify(nextJob),
        created_at: now,
      },
      alert: createAlert({
        id: newId(),
        workspace_id: schedule.workspace_id,
        severity: "critical",
        source_type: "publish",
        source_id: nextJob.id,
        code: errorCode,
        message: errorMessage,
        payload: JSON.stringify({ publish_job_id: nextJob.id, schedule_id: schedule.id }),
        created_at: now,
      }),
    });

    return nextJob;
  }
}
