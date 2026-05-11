import type { QueueAccountAutomationTick } from "../../orchestration/application/commands/queue-account-automation-tick";
import type { WorkerJobsRepository } from "../../execution/application/ports/worker-jobs-repository";
import type { WorkerJob } from "../../execution/domain/worker-job";
import { evaluateEngagementAutomationTargets } from "./engagement-policy-validation";
import type { EngagementPoliciesRepository } from "./ports/engagement-policies-repository";
import type { AccountsRepository } from "../../accounts/application/ports/accounts-repository";

export const ENGAGEMENT_CANDIDATE_POOL_REFRESH_INTERVAL_MINUTES = 15;

export async function reconcileEngagementCandidatePoolWorkerJobs(input: {
  policies: EngagementPoliciesRepository;
  accounts: AccountsRepository;
  workerJobs: WorkerJobsRepository;
  queueAccountAutomationTick: QueueAccountAutomationTick;
  now: string;
  limit?: number;
}) {
  const policies = await input.policies.listActive();
  let queued = 0;

  for (const policy of policies.slice(0, input.limit ?? 50)) {
    const account = await input.accounts.findById(policy.account_id);
    const validation = evaluateEngagementAutomationTargets(policy.policy_body, account?.handle ?? "");
    const hasCandidateDrivenAutomation = validation.valid_features.some((feature) =>
      feature === "auto_follow" || feature === "auto_retweet" || feature === "auto_comment",
    );
    if (!hasCandidateDrivenAutomation) {
      continue;
    }

    const latestTick = await input.workerJobs.findLatestByTypeAndTarget("orchestration.tick", "account", policy.account_id);
    if (latestTick && (latestTick.status === "queued" || latestTick.status === "running")) {
      continue;
    }
    if (latestTick && !isDue(latestTick, input.now)) {
      continue;
    }

    await input.queueAccountAutomationTick.execute({
      account_id: policy.account_id,
      trigger_kind: "system",
      create_if_missing: true,
      run_after: input.now,
    });
    queued += 1;
  }

  return {
    checked_policies: Math.min(policies.length, input.limit ?? 50),
    queued,
  };
}

function isDue(job: WorkerJob, now: string) {
  const latestTimestamp = job.finished_at ?? job.started_at ?? job.run_after ?? job.created_at;
  const dueAfter = Date.parse(latestTimestamp) + ENGAGEMENT_CANDIDATE_POOL_REFRESH_INTERVAL_MINUTES * 60_000;
  const nowMs = Date.parse(now);

  if (!Number.isFinite(dueAfter) || !Number.isFinite(nowMs)) {
    return true;
  }

  return dueAfter <= nowMs;
}
