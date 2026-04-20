import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { AgentRuntimeRepository } from "../../../agent-runtime/application/ports/agent-runtime-repository";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { ApproveDraft } from "../../../drafts/application/commands/approve-draft";
import type { DraftsRepository } from "../../../drafts/application/ports/drafts-repository";
import type { QueuePublishJob } from "../../../schedules/application/commands/queue-publish-job";
import type { ScheduleDraft } from "../../../schedules/application/commands/schedule-draft";
import { createAutopostPolicy } from "../../domain/autopost-policy";
import {
  markAutopostRunAwaitingReview,
  markAutopostRunPublishQueued,
  markAutopostRunScheduled,
} from "../../domain/autopost-run";
import type { AutopostPoliciesRepository } from "../ports/autopost-policies-repository";
import type { AutopostRunsRepository } from "../ports/autopost-runs-repository";
import type { FailAutopostRun } from "./fail-autopost-run";

export interface FinalizeAutopostRunDependencies {
  runtime: AgentRuntimeRepository;
  policies: AutopostPoliciesRepository;
  runs: AutopostRunsRepository;
  drafts: DraftsRepository;
  approveDraft: ApproveDraft;
  scheduleDraft: ScheduleDraft;
  queuePublishJob: QueuePublishJob;
  failAutopostRun: FailAutopostRun;
  auditLogs: AuditLogRepository;
  clock: Clock;
}

export class FinalizeAutopostRun {
  constructor(private readonly deps: FinalizeAutopostRunDependencies) {}

  async execute(runId: string) {
    const run = await this.deps.runs.findById(runId);
    if (!run) {
      throw new AppError("NOT_FOUND", "autopost run not found", {
        details: { autopost_run_id: runId },
      });
    }
    if (run.status !== "draft_generating") {
      throw new AppError("INVALID_STATE", "autopost run is not ready to finalize", {
        details: { autopost_run_id: run.id, status: run.status, draft_id: run.draft_id },
      });
    }
    const draftId = run.draft_id ?? await this.resolveDraftId(run);

    const policy = await this.deps.policies.findById(run.policy_id);
    if (!policy) {
      throw new AppError("NOT_FOUND", "autopost policy not found", {
        details: { autopost_policy_id: run.policy_id, autopost_run_id: run.id },
      });
    }

    try {
      const now = this.deps.clock.now().toISOString();
      let nextRun;
      if (policy.execution_body.draft_review_mode === "manual") {
        nextRun = markAutopostRunAwaitingReview(run, {
          draft_id: draftId,
          updated_at: now,
        });
      } else {
        await this.deps.approveDraft.execute(draftId, {
          reviewer_type: "agent",
          reviewer_id: run.id,
          comment: "autopost policy auto-approved draft",
        });
        const schedule = await this.deps.scheduleDraft.execute(draftId, {
          scheduled_for: run.scheduled_for,
        });
        nextRun = policy.execution_body.auto_queue_publish
          ? markAutopostRunPublishQueued(run, {
            draft_id: draftId,
            schedule_id: schedule.id,
            publish_job_id: (await this.deps.queuePublishJob.execute(schedule.id)).id,
            updated_at: now,
          })
          : markAutopostRunScheduled(run, {
            draft_id: draftId,
            schedule_id: schedule.id,
            updated_at: now,
          });
      }

      const nextPolicy = createAutopostPolicy({
        ...policy,
        last_run_id: run.id,
        last_run_status: "succeeded",
        last_failed_at: undefined,
        last_error_code: undefined,
        last_error_message: undefined,
        updated_at: now,
      });

      await this.deps.runs.save(nextRun);
      await this.deps.policies.save(nextPolicy);
      await this.deps.auditLogs.append({
        id: newId(),
        workspace_id: run.workspace_id,
        actor_type: "system",
        entity_type: "autopost_run",
        entity_id: run.id,
        action: `autopost_run.${nextRun.status}`,
        before_state: JSON.stringify(run),
        after_state: JSON.stringify(nextRun),
        created_at: now,
      });

      return {
        run: nextRun,
        policy: nextPolicy,
      };
    } catch (error) {
      const appError = error instanceof AppError
        ? error
        : new AppError("EXTERNAL_DEPENDENCY_ERROR", "autopost run finalization failed", { cause: error });
      await this.deps.failAutopostRun.execute(run.id, appError.code, appError.message);
      throw appError;
    }
  }

  private async resolveDraftId(run: { id: string; draft_task_id?: string }) {
    if (!run.draft_task_id) {
      throw new AppError("INVALID_STATE", "autopost run is missing draft_task_id required to resolve draft", {
        details: { autopost_run_id: run.id },
      });
    }

    const latestRun = await this.deps.runtime.findLatestRunByTaskId(run.draft_task_id);
    if (!latestRun) {
      throw new AppError("NOT_FOUND", "autopost draft task run not found", {
        details: { autopost_run_id: run.id, draft_task_id: run.draft_task_id },
      });
    }

    const draft = await this.deps.drafts.findByGeneratedRunId(latestRun.id);
    if (!draft) {
      throw new AppError("NOT_FOUND", "autopost generated draft not found", {
        details: { autopost_run_id: run.id, draft_task_id: run.draft_task_id, agent_run_id: latestRun.id },
      });
    }

    return draft.id;
  }
}
