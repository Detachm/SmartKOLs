import { AppError } from "../../../../core/errors/app-error";
import type { Clock } from "../../../../core/time/clock";
import type { PullDirectMessages } from "../../../connector-x/application/commands/pull-direct-messages";
import type { PullMentions } from "../../../connector-x/application/commands/pull-mentions";
import type { QueueAccountAutomationTick } from "../../../orchestration/application/commands/queue-account-automation-tick";
import type { FailRecurringBriefPlanExecution } from "../../../editorial/application/commands/fail-recurring-brief-plan-execution";
import type { RecurringBriefPlansRepository } from "../../../editorial/application/ports/recurring-brief-plans-repository";
import type { SendReplyProposal } from "../../../engagement/application/commands/send-reply-proposal";
import type { TickAccountAutomation } from "../../../orchestration/application/commands/tick-account-automation";
import type { WorkerJobsRepository } from "../ports/worker-jobs-repository";
import type { AutopostPoliciesRepository } from "../../../autopost/application/ports/autopost-policies-repository";
import { startWorkerJob, succeedWorkerJob, type WorkerJob } from "../../domain/worker-job";
import type { FailWorkerJob } from "./fail-worker-job";

export interface RunWorkerJobDependencies {
  workerJobs: WorkerJobsRepository;
  pullMentions: PullMentions;
  pullDirectMessages: PullDirectMessages;
  sendReplyProposal: SendReplyProposal;
  autopostPolicies: AutopostPoliciesRepository;
  recurringBriefPlans: RecurringBriefPlansRepository;
  queueAccountAutomationTick: QueueAccountAutomationTick;
  tickAccountAutomation: TickAccountAutomation;
  failRecurringBriefPlanExecution: FailRecurringBriefPlanExecution;
  failWorkerJob: FailWorkerJob;
  clock: Clock;
}

export class RunWorkerJob {
  constructor(private readonly deps: RunWorkerJobDependencies) {}

  async execute(jobId: string, options?: { claimed?: boolean }) {
    const job = await this.deps.workerJobs.findById(jobId);
    if (!job) {
      throw new AppError("NOT_FOUND", "worker job not found", {
        details: { worker_job_id: jobId },
      });
    }

    const now = this.deps.clock.now().toISOString();
    const runningJob = resolveRunningWorkerJob(job, options?.claimed, now);
    if (job.status === "queued") {
      await this.deps.workerJobs.save(runningJob);
    }

    try {
      await this.dispatch(runningJob);
      const nextJob = succeedWorkerJob(runningJob, this.deps.clock.now().toISOString());
      await this.deps.workerJobs.save(nextJob);
      return nextJob;
    } catch (error) {
      const appError = error instanceof AppError
        ? error
        : new AppError("EXTERNAL_DEPENDENCY_ERROR", "worker job execution failed", { cause: error });
      const cleanupErrors: string[] = [];
      if (job.job_type === "editorial.recurring_brief.execute") {
        try {
          await this.deps.failRecurringBriefPlanExecution.execute(job.target_id, appError.code, appError.message);
        } catch (cleanupError) {
          cleanupErrors.push(cleanupError instanceof Error ? cleanupError.message : "recurring plan cleanup failed");
        }
      }
      try {
        await this.deps.failWorkerJob.execute(jobId, appError.code, appError.message);
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError instanceof Error ? cleanupError.message : "worker job cleanup failed");
      }
      if (cleanupErrors.length > 0) {
        throw new AppError("INTERNAL_ERROR", "worker job failed and cleanup was incomplete", {
          details: {
            worker_job_id: jobId,
            original_error_code: appError.code,
            original_error_message: appError.message,
            cleanup_errors: cleanupErrors,
          },
          cause: appError,
        });
      }
      throw appError;
    }
  }

  private async dispatch(job: WorkerJob) {
    const payload = JSON.parse(job.payload) as Record<string, unknown>;

    if (job.job_type === "mentions.pull") {
      const accountId = requirePayloadString(payload.account_id, "account_id", job.id);
      await this.deps.pullMentions.execute(accountId);
      await this.deps.queueAccountAutomationTick.execute({
        account_id: accountId,
        trigger_kind: "system",
        create_if_missing: true,
      });
      return;
    }

    if (job.job_type === "dm.pull") {
      const accountId = requirePayloadString(payload.account_id, "account_id", job.id);
      await this.deps.pullDirectMessages.execute(accountId);
      await this.deps.queueAccountAutomationTick.execute({
        account_id: accountId,
        trigger_kind: "system",
        create_if_missing: true,
      });
      return;
    }

    if (job.job_type === "engagement.reply.execute") {
      const proposalId = requirePayloadString(payload.proposal_id, "proposal_id", job.id);
      await this.deps.sendReplyProposal.execute(proposalId);
      return;
    }

    if (job.job_type === "editorial.recurring_brief.execute") {
      const planId = requirePayloadString(payload.plan_id, "plan_id", job.id);
      const accountId = await resolveRecurringPlanAccountId(this.deps.recurringBriefPlans, planId, payload, job.id);
      await this.deps.queueAccountAutomationTick.execute({
        account_id: accountId,
        trigger_kind: "system",
        create_if_missing: true,
      });
      return;
    }

    if (job.job_type === "autopost.execute") {
      const policyId = requirePayloadString(payload.policy_id, "policy_id", job.id);
      const accountId = await resolveAutopostPolicyAccountId(this.deps.autopostPolicies, policyId, payload, job.id);
      await this.deps.queueAccountAutomationTick.execute({
        account_id: accountId,
        trigger_kind: "system",
        create_if_missing: true,
      });
      return;
    }

    if (job.job_type === "orchestration.tick") {
      const accountId = requirePayloadString(payload.account_id, "account_id", job.id);
      await this.deps.tickAccountAutomation.execute({
        account_id: accountId,
        trigger_kind: resolveTriggerKind(payload.trigger_kind),
      });
      return;
    }

    throw new AppError("INVALID_STATE", "unsupported worker job type", {
      details: { worker_job_id: job.id, job_type: job.job_type },
    });
  }
}

function resolveRunningWorkerJob(job: WorkerJob, claimed: boolean | undefined, startedAt: string): WorkerJob {
  if (job.status === "queued") {
    return startWorkerJob(job, startedAt, addMinutes(startedAt, 15));
  }

  if (claimed && job.status === "running") {
    return job;
  }

  throw new AppError("INVALID_STATE", "worker job cannot execute from current state", {
    details: { worker_job_id: job.id, status: job.status, claimed: Boolean(claimed) },
  });
}

function requirePayloadString(value: unknown, field: string, jobId: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new AppError("INVALID_STATE", `worker job payload field ${field} is required`, {
      details: { worker_job_id: jobId, field },
    });
  }

  return value.trim();
}

function resolveTriggerKind(value: unknown): "manual" | "content_task_follow_up" | "draft_review_follow_up" | "system" {
  if (value === "manual" || value === "content_task_follow_up" || value === "draft_review_follow_up" || value === "system") {
    return value;
  }

  return "system";
}

async function resolveRecurringPlanAccountId(
  plans: RecurringBriefPlansRepository,
  planId: string,
  payload: Record<string, unknown>,
  jobId: string,
): Promise<string> {
  if (typeof payload.account_id === "string" && payload.account_id.trim() !== "") {
    return payload.account_id.trim();
  }

  const plan = await plans.findById(planId);
  if (!plan) {
    throw new AppError("NOT_FOUND", "recurring brief plan not found", {
      details: { worker_job_id: jobId, plan_id: planId },
    });
  }

  return plan.account_id;
}

async function resolveAutopostPolicyAccountId(
  policies: AutopostPoliciesRepository,
  policyId: string,
  payload: Record<string, unknown>,
  jobId: string,
): Promise<string> {
  if (typeof payload.account_id === "string" && payload.account_id.trim() !== "") {
    return payload.account_id.trim();
  }

  const policy = await policies.findById(policyId);
  if (!policy) {
    throw new AppError("NOT_FOUND", "autopost policy not found", {
      details: { worker_job_id: jobId, policy_id: policyId },
    });
  }

  return policy.account_id;
}

function addMinutes(isoTimestamp: string, minutes: number): string {
  return new Date(new Date(isoTimestamp).getTime() + minutes * 60_000).toISOString();
}
