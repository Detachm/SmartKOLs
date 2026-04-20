import { AppError } from "../../../../core/errors/app-error";
import type { Clock } from "../../../../core/time/clock";
import type { DraftVersionRepository } from "../../../drafts/application/ports/draft-version-repository";
import type { DraftsRepository } from "../../../drafts/application/ports/drafts-repository";
import type { CreatePost } from "../../../connector-x/application/commands/create-post";
import { markPublishJobRunning } from "../../domain/publish-job";
import type { SchedulesRepository } from "../ports/schedules-repository";
import type { MarkPublishFailed } from "./mark-publish-failed";
import type { CompletePublishJob } from "./complete-publish-job";

export interface ExecutePublishJobDependencies {
  schedules: SchedulesRepository;
  drafts: DraftsRepository;
  versions: DraftVersionRepository;
  createPost: CreatePost;
  completePublishJob: CompletePublishJob;
  markPublishFailed: MarkPublishFailed;
  clock: Clock;
}

export class ExecutePublishJob {
  constructor(private readonly deps: ExecutePublishJobDependencies) {}

  async execute(publishJobId: string, options?: { claimed?: boolean }) {
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
      throw new AppError("NOT_FOUND", "draft not found", {
        details: { draft_id: schedule.draft_id },
      });
    }

    if (!draft.current_version_id) {
      throw new AppError("INVALID_STATE", "draft current_version_id is required for publish execution", {
        details: { draft_id: draft.id },
      });
    }

    const version = await this.deps.versions.findById(draft.current_version_id);
    if (!version) {
      throw new AppError("NOT_FOUND", "draft current version not found", {
        details: { draft_id: draft.id, version_id: draft.current_version_id },
      });
    }

    const runningJob = resolveRunningPublishJob(job, options?.claimed, this.deps.clock.now().toISOString());
    if (job.status === "queued") {
      await this.deps.schedules.savePublishJob(runningJob);
    }

    try {
      const post = await this.deps.createPost.execute({
        account_id: schedule.account_id,
        text: version.content,
        idempotency_key_override: runningJob.idempotency_key,
      });

      return await this.deps.completePublishJob.execute(publishJobId, {
        connector_request_id: post.connector_request_id,
        external_post_id: post.external_post_id,
        external_post_url: post.external_post_url,
      });
    } catch (error) {
      const appError = error instanceof AppError
        ? error
        : new AppError("EXTERNAL_DEPENDENCY_ERROR", "publish execution failed", { cause: error });

      await this.deps.markPublishFailed.execute(publishJobId, appError.code, appError.message);
      throw appError;
    }
  }
}

function resolveRunningPublishJob(
  job: {
    id: string;
    status: "queued" | "running" | "succeeded" | "failed";
    schedule_id: string;
    idempotency_key: string;
    error_code?: string;
    error_message?: string;
    run_after: string;
    started_at?: string;
    lease_expires_at?: string;
    finished_at?: string;
  },
  claimed: boolean | undefined,
  startedAt: string,
) {
  if (job.status === "queued") {
    return markPublishJobRunning(job, startedAt, addMinutes(startedAt, 15));
  }

  if (claimed && job.status === "running") {
    return job;
  }

  throw new AppError("INVALID_STATE", "publish job cannot execute from current state", {
    details: { publish_job_id: job.id, status: job.status, claimed: Boolean(claimed) },
  });
}

function addMinutes(isoTimestamp: string, minutes: number): string {
  return new Date(new Date(isoTimestamp).getTime() + minutes * 60_000).toISOString();
}
