import test from "node:test";
import assert from "node:assert/strict";
import {
  ENGAGEMENT_CANDIDATE_POOL_REFRESH_INTERVAL_MINUTES,
  reconcileEngagementCandidatePoolWorkerJobs,
} from "./reconcile-engagement-candidate-pool-worker-jobs";
import type { WorkerJob } from "../../execution/domain/worker-job";

function buildPolicy(input: {
  account_id: string;
  auto_follow?: boolean;
  auto_retweet?: boolean;
  auto_comment?: boolean;
  auto_reply?: boolean;
}) {
  return {
    id: `policy_${input.account_id}`,
    workspace_id: "ws_1",
    account_id: input.account_id,
    policy_body: {
      allowed_channels: ["mention", "reply"],
      blocked_classifications: ["spam"],
      require_manual_approval: true,
      auto_follow: { enabled: Boolean(input.auto_follow), max_per_day: 10, rules: [{ type: "keyword", value: "ai" }] },
      auto_retweet: {
        enabled: Boolean(input.auto_retweet),
        max_per_day: 3,
        min_likes: 1,
        whitelist: ["@external"],
        keywords: [],
        delay_min_minutes: 1,
        delay_max_minutes: 2,
        quote_tweet_enabled: false,
      },
      auto_comment: {
        enabled: Boolean(input.auto_comment),
        max_per_day: 3,
        target_handles: ["@external"],
        style: "supportive",
        mode: "latest",
      },
      auto_reply: {
        enabled: Boolean(input.auto_reply),
        max_per_day: 30,
        trigger_types: ["mention"],
        only_followers: false,
        style: "grateful",
      },
    },
    status: "active",
    updated_at: "2026-04-24T10:00:00.000Z",
  } as const;
}

function buildTick(input: Partial<WorkerJob> & Pick<WorkerJob, "target_id" | "status">): WorkerJob {
  return {
    id: `tick_${input.target_id}`,
    workspace_id: "ws_1",
    job_type: "orchestration.tick",
    target_type: "account",
    payload: JSON.stringify({ account_id: input.target_id }),
    run_after: "2026-04-24T10:00:00.000Z",
    created_at: "2026-04-24T10:00:00.000Z",
    ...input,
  };
}

test("reconcileEngagementCandidatePoolWorkerJobs queues automation ticks for candidate-driven policies", async () => {
  const queued: string[] = [];
  const result = await reconcileEngagementCandidatePoolWorkerJobs({
    policies: {
      listActive: async () => [
        buildPolicy({ account_id: "acct_follow", auto_follow: true }),
        buildPolicy({ account_id: "acct_repost", auto_retweet: true }),
        buildPolicy({ account_id: "acct_comment", auto_comment: true }),
        buildPolicy({ account_id: "acct_reply_only", auto_reply: true }),
      ],
    } as never,
    accounts: {
      findById: async (id: string) => ({ id, handle: "@self" }),
    } as never,
    workerJobs: {
      findLatestByTypeAndTarget: async () => null,
    } as never,
    queueAccountAutomationTick: {
      execute: async (input: { account_id: string }) => {
        queued.push(input.account_id);
        return null;
      },
    } as never,
    now: "2026-04-24T10:30:00.000Z",
  });

  assert.deepEqual(queued, ["acct_follow", "acct_repost", "acct_comment"]);
  assert.equal(result.queued, 3);
});

test("reconcileEngagementCandidatePoolWorkerJobs skips queued, running, and fresh candidate ticks", async () => {
  const queued: string[] = [];
  const freshFinishedAt = new Date(
    Date.parse("2026-04-24T10:30:00.000Z") - (ENGAGEMENT_CANDIDATE_POOL_REFRESH_INTERVAL_MINUTES - 1) * 60_000,
  ).toISOString();

  const result = await reconcileEngagementCandidatePoolWorkerJobs({
    policies: {
      listActive: async () => [
        buildPolicy({ account_id: "acct_queued", auto_follow: true }),
        buildPolicy({ account_id: "acct_running", auto_follow: true }),
        buildPolicy({ account_id: "acct_fresh", auto_follow: true }),
        buildPolicy({ account_id: "acct_due", auto_follow: true }),
      ],
    } as never,
    accounts: {
      findById: async (id: string) => ({ id, handle: "@self" }),
    } as never,
    workerJobs: {
      findLatestByTypeAndTarget: async (_jobType: string, _targetType: string, accountId: string) => {
        if (accountId === "acct_queued") {
          return buildTick({ target_id: accountId, status: "queued" });
        }
        if (accountId === "acct_running") {
          return buildTick({ target_id: accountId, status: "running" });
        }
        if (accountId === "acct_fresh") {
          return buildTick({ target_id: accountId, status: "succeeded", finished_at: freshFinishedAt });
        }
        if (accountId === "acct_due") {
          return buildTick({ target_id: accountId, status: "succeeded", finished_at: "2026-04-24T10:00:00.000Z" });
        }
        return null;
      },
    } as never,
    queueAccountAutomationTick: {
      execute: async (input: { account_id: string }) => {
        queued.push(input.account_id);
        return null;
      },
    } as never,
    now: "2026-04-24T10:30:00.000Z",
  });

  assert.deepEqual(queued, ["acct_due"]);
  assert.equal(result.queued, 1);
});
