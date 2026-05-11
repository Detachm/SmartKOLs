import type { QueuePullDirectMessagesJob } from "../../execution/application/commands/queue-pull-direct-messages-job";
import type { QueuePullMentionsJob } from "../../execution/application/commands/queue-pull-mentions-job";
import type { WorkerJobsRepository } from "../../execution/application/ports/worker-jobs-repository";
import type { WorkerJob, WorkerJobType } from "../../execution/domain/worker-job";
import type { EngagementPolicy } from "../domain/engagement-policy";
import type { EngagementPoliciesRepository } from "./ports/engagement-policies-repository";

export const ENGAGEMENT_INBOX_PULL_INTERVAL_MINUTES = 60;

export async function reconcileEngagementInboxPullWorkerJobs(input: {
  policies: EngagementPoliciesRepository;
  workerJobs: WorkerJobsRepository;
  queuePullMentionsJob: QueuePullMentionsJob;
  queuePullDirectMessagesJob: QueuePullDirectMessagesJob;
  now: string;
  limit?: number;
}) {
  const policies = await input.policies.listActive();
  let queued_mentions = 0;
  let queued_direct_messages = 0;

  for (const policy of policies.slice(0, input.limit ?? 50)) {
    if (shouldPullMentions(policy)) {
      const queued = await queueIfDue({
        job_type: "mentions.pull",
        account_id: policy.account_id,
        workerJobs: input.workerJobs,
        now: input.now,
        queue: () => input.queuePullMentionsJob.execute(policy.account_id),
      });
      if (queued) {
        queued_mentions += 1;
      }
    }

    if (shouldPullDirectMessages(policy)) {
      const queued = await queueIfDue({
        job_type: "dm.pull",
        account_id: policy.account_id,
        workerJobs: input.workerJobs,
        now: input.now,
        queue: () => input.queuePullDirectMessagesJob.execute(policy.account_id),
      });
      if (queued) {
        queued_direct_messages += 1;
      }
    }
  }

  return {
    checked_policies: Math.min(policies.length, input.limit ?? 50),
    queued_mentions,
    queued_direct_messages,
  };
}

function shouldPullMentions(policy: EngagementPolicy) {
  return policy.policy_body.allowed_channels.includes("mention")
    || policy.policy_body.allowed_channels.includes("reply");
}

function shouldPullDirectMessages(policy: EngagementPolicy) {
  return policy.policy_body.allowed_channels.includes("dm");
}

async function queueIfDue(input: {
  job_type: WorkerJobType;
  account_id: string;
  workerJobs: WorkerJobsRepository;
  now: string;
  queue: () => Promise<WorkerJob>;
}) {
  const latest = await input.workerJobs.findLatestByTypeAndTarget(input.job_type, "account", input.account_id);
  if (latest && (latest.status === "queued" || latest.status === "running")) {
    return false;
  }

  if (latest && !isDue(latest, input.now)) {
    return false;
  }

  await input.queue();
  return true;
}

function isDue(job: WorkerJob, now: string) {
  const latestTimestamp = job.finished_at ?? job.started_at ?? job.run_after ?? job.created_at;
  const dueAfter = Date.parse(latestTimestamp) + ENGAGEMENT_INBOX_PULL_INTERVAL_MINUTES * 60_000;
  const nowMs = Date.parse(now);

  if (!Number.isFinite(dueAfter) || !Number.isFinite(nowMs)) {
    return true;
  }

  return dueAfter <= nowMs;
}
