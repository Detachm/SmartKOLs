import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { CompletePublishJobRequest } from "../../../../contracts/api/account-credentials";
import { requireNonEmptyString } from "../../../../core/validation/guards";
import type { DraftVersionRepository } from "../../../drafts/application/ports/draft-version-repository";
import type { DraftsRepository } from "../../../drafts/application/ports/drafts-repository";
import { markPublishJobSucceeded } from "../../domain/publish-job";
import { markSchedulePublished } from "../../domain/publish-schedule";
import type { PublishWriteTransaction } from "../ports/publish-write-transaction";
import type { SchedulesRepository } from "../ports/schedules-repository";

export interface PublishedPostsRepository {
  create(input: {
    id: string;
    workspace_id: string;
    account_id: string;
    draft_id?: string;
    connector_request_id: string;
    external_post_id: string;
    external_post_url?: string;
    content: string;
    published_at: string;
  }): Promise<void>;
}

export interface CompletePublishJobDependencies {
  schedules: SchedulesRepository;
  drafts: DraftsRepository;
  versions: DraftVersionRepository;
  publishWrites: PublishWriteTransaction;
  clock: Clock;
}

export class CompletePublishJob {
  constructor(private readonly deps: CompletePublishJobDependencies) {}

  async execute(publishJobId: string, input: CompletePublishJobRequest) {
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
      throw new AppError("NOT_FOUND", "draft not found for publish completion", {
        details: { draft_id: schedule.draft_id },
      });
    }

    if (!draft.current_version_id) {
      throw new AppError("INVALID_STATE", "draft current_version_id is required for publish completion", {
        details: { draft_id: draft.id },
      });
    }

    const version = await this.deps.versions.findById(draft.current_version_id);
    if (!version) {
      throw new AppError("NOT_FOUND", "draft current version not found for publish completion", {
        details: { draft_id: draft.id, version_id: draft.current_version_id },
      });
    }

    const connectorRequestId = requireNonEmptyString(input.connector_request_id, "connector_request_id");
    const externalPostId = input.external_post_id?.trim();
    if (!externalPostId) {
      throw new AppError("VALIDATION_ERROR", "external_post_id is required to complete publish job", {
        details: { publish_job_id: publishJobId },
      });
    }

    const now = this.deps.clock.now().toISOString();
    const nextJob = markPublishJobSucceeded(job, now);
    const nextSchedule = markSchedulePublished(schedule);
    const nextDraft = {
      ...draft,
      status: "published" as const,
      updated_at: now,
    };

    await this.deps.publishWrites.commitPublishCompletion({
      next_job: nextJob,
      next_schedule: nextSchedule,
      next_draft: nextDraft,
      published_post: {
        id: newId(),
        workspace_id: schedule.workspace_id,
        account_id: schedule.account_id,
        draft_id: draft.id,
        connector_request_id: connectorRequestId,
        external_post_id: externalPostId,
        external_post_url: input.external_post_url?.trim() || undefined,
        content: version.content,
        published_at: now,
      },
      audit_log: {
        id: newId(),
        workspace_id: schedule.workspace_id,
        actor_type: "system",
        entity_type: "publish_job",
        entity_id: job.id,
        action: "publish_job.completed",
        before_state: JSON.stringify(job),
        after_state: JSON.stringify(nextJob),
        created_at: now,
      },
    });

    return nextJob;
  }
}
