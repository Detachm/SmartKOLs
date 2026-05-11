import test from "node:test";
import assert from "node:assert/strict";
import {
  ENGAGEMENT_INBOX_PULL_INTERVAL_MINUTES,
  reconcileEngagementInboxPullWorkerJobs,
} from "./reconcile-engagement-inbox-pull-worker-jobs";
import type { WorkerJob } from "../../execution/domain/worker-job";

function buildPolicy(overrides: {
  account_id?: string;
  allowed_channels?: Array<"mention" | "reply" | "dm" | "comment">;
} = {}) {
  return {
    id: `policy_${overrides.account_id ?? "acct_1"}`,
    workspace_id: "ws_1",
    account_id: overrides.account_id ?? "acct_1",
    policy_body: {
      allowed_channels: overrides.allowed_channels ?? ["mention", "reply"],
      blocked_classifications: ["spam"],
      require_manual_approval: true,
      auto_reply: {
        enabled: true,
        max_per_day: 30,
        trigger_types: overrides.allowed_channels ?? ["mention", "reply"],
        only_followers: false,
        style: "grateful",
      },
    },
    status: "active",
    updated_at: "2026-04-24T10:00:00.000Z",
  } as const;
}

function buildJob(input: Partial<WorkerJob> & Pick<WorkerJob, "job_type" | "target_id" | "status">): WorkerJob {
  return {
    id: `job_${input.job_type}_${input.target_id}`,
    workspace_id: "ws_1",
    target_type: "account",
    payload: JSON.stringify({ account_id: input.target_id }),
    run_after: "2026-04-24T10:00:00.000Z",
    created_at: "2026-04-24T10:00:00.000Z",
    ...input,
  };
}

test("reconcileEngagementInboxPullWorkerJobs queues mentions and DM pulls from active policy channels", async () => {
  const mentionAccountIds: string[] = [];
  const dmAccountIds: string[] = [];

  const result = await reconcileEngagementInboxPullWorkerJobs({
    policies: {
      listActive: async () => [
        buildPolicy({ account_id: "acct_mentions", allowed_channels: ["mention", "reply"] }),
        buildPolicy({ account_id: "acct_dm", allowed_channels: ["dm"] }),
        buildPolicy({ account_id: "acct_both", allowed_channels: ["reply", "dm"] }),
      ],
    } as never,
    workerJobs: {
      findLatestByTypeAndTarget: async () => null,
    } as never,
    queuePullMentionsJob: {
      execute: async (accountId: string) => {
        mentionAccountIds.push(accountId);
        return buildJob({ job_type: "mentions.pull", target_id: accountId, status: "queued" });
      },
    } as never,
    queuePullDirectMessagesJob: {
      execute: async (accountId: string) => {
        dmAccountIds.push(accountId);
        return buildJob({ job_type: "dm.pull", target_id: accountId, status: "queued" });
      },
    } as never,
    now: "2026-04-24T10:30:00.000Z",
  });

  assert.deepEqual(mentionAccountIds, ["acct_mentions", "acct_both"]);
  assert.deepEqual(dmAccountIds, ["acct_dm", "acct_both"]);
  assert.equal(result.queued_mentions, 2);
  assert.equal(result.queued_direct_messages, 2);
});

test("reconcileEngagementInboxPullWorkerJobs skips queued, running, and fresh completed pulls", async () => {
  const queuedAccountIds: string[] = [];
  const freshFinishedAt = new Date(
    Date.parse("2026-04-24T10:30:00.000Z") - (ENGAGEMENT_INBOX_PULL_INTERVAL_MINUTES - 1) * 60_000,
  ).toISOString();

  const result = await reconcileEngagementInboxPullWorkerJobs({
    policies: {
      listActive: async () => [
        buildPolicy({ account_id: "acct_queued", allowed_channels: ["mention"] }),
        buildPolicy({ account_id: "acct_running", allowed_channels: ["mention"] }),
        buildPolicy({ account_id: "acct_fresh", allowed_channels: ["mention"] }),
        buildPolicy({ account_id: "acct_due", allowed_channels: ["mention"] }),
      ],
    } as never,
    workerJobs: {
      findLatestByTypeAndTarget: async (_jobType: string, _targetType: string, accountId: string) => {
        if (accountId === "acct_queued") {
          return buildJob({ job_type: "mentions.pull", target_id: accountId, status: "queued" });
        }
        if (accountId === "acct_running") {
          return buildJob({ job_type: "mentions.pull", target_id: accountId, status: "running" });
        }
        if (accountId === "acct_fresh") {
          return buildJob({ job_type: "mentions.pull", target_id: accountId, status: "succeeded", finished_at: freshFinishedAt });
        }
        if (accountId === "acct_due") {
          return buildJob({ job_type: "mentions.pull", target_id: accountId, status: "succeeded", finished_at: "2026-04-24T09:00:00.000Z" });
        }
        return null;
      },
    } as never,
    queuePullMentionsJob: {
      execute: async (accountId: string) => {
        queuedAccountIds.push(accountId);
        return buildJob({ job_type: "mentions.pull", target_id: accountId, status: "queued" });
      },
    } as never,
    queuePullDirectMessagesJob: {
      execute: async (accountId: string) => buildJob({ job_type: "dm.pull", target_id: accountId, status: "queued" }),
    } as never,
    now: "2026-04-24T10:30:00.000Z",
  });

  assert.deepEqual(queuedAccountIds, ["acct_due"]);
  assert.equal(result.queued_mentions, 1);
});
