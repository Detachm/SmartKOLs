import test from "node:test";
import assert from "node:assert/strict";
import { EvaluateAccountEligibility } from "./evaluate-account-eligibility";
import type { AccountAutomationOverview } from "../ports/account-automation-overview-read-model";

function buildOverview(overrides: Partial<AccountAutomationOverview> = {}): AccountAutomationOverview {
  return {
    account_id: "acct_1",
    workspace_id: "ws_1",
    account_handle: "@acct_1",
    has_active_automation: true,
    pending_draft_count: 0,
    max_pending_manual_review_drafts: 5,
    queued_or_running_content_tasks: [],
    engagement_automation: {
      policy_body: {
        allowed_channels: ["mention", "reply"],
        blocked_classifications: ["spam"],
        require_manual_approval: true,
        auto_follow: {
          enabled: false,
          max_per_day: 15,
          rules: [],
        },
        auto_retweet: {
          enabled: false,
          max_per_day: 3,
          min_likes: 0,
          whitelist: [],
          keywords: [],
          delay_min_minutes: 30,
          delay_max_minutes: 120,
          quote_tweet_enabled: false,
        },
        auto_comment: {
          enabled: false,
          max_per_day: 5,
          target_handles: [],
          style: "supportive",
          mode: "latest",
        },
        auto_reply: {
          enabled: true,
          max_per_day: 30,
          trigger_types: ["mention", "reply"],
          only_followers: false,
          style: "grateful",
        },
      },
      policy_status: "active",
      open_thread_count: 0,
      policy_blocked_open_thread_count: 0,
      pending_review_reply_count: 0,
      approved_reply_pending_send_count: 0,
      today_follow_count: 0,
      today_repost_count: 0,
      today_comment_count: 0,
      today_reply_count: 0,
    },
    ...overrides,
  };
}

test("EvaluateAccountEligibility prioritizes autopost continuation over new due work", () => {
  const evaluation = new EvaluateAccountEligibility().execute(buildOverview({
    active_autopost_run: {
      run_id: "run_1",
      policy_id: "policy_1",
      status: "brief_generating",
      scheduled_for: "2026-04-19T10:00:00.000Z",
      brief_id: "brief_1",
      brief_task_id: "task_1",
      brief_task_status: "succeeded",
    },
    next_due_autopost_policy: {
      policy_id: "policy_2",
      generation_mode: "from_trend",
      next_run_after: "2026-04-19T09:00:00.000Z",
      draft_review_mode: "manual",
      auto_queue_publish: false,
      max_pending_manual_review_drafts: 5,
    },
    next_due_recurring_plan: {
      plan_id: "plan_1",
      name: "daily brief",
      generation_mode: "from_trend",
      next_run_after: "2026-04-19T09:00:00.000Z",
    },
  }), "2026-04-19T10:30:00.000Z");

  assert.equal(evaluation.eligible_actions.length, 1);
  assert.equal(evaluation.eligible_actions[0]?.type, "autopost.generate_draft_from_run");
  assert.equal(evaluation.eligible_actions[0]?.priority_score, 400);
});

test("EvaluateAccountEligibility blocks when pending draft backlog reaches threshold", () => {
  const evaluation = new EvaluateAccountEligibility().execute(buildOverview({
    pending_draft_count: 5,
    latest_ready_brief_without_draft: {
      brief_id: "brief_1",
      generation_mode: "from_trend",
      topic: "topic",
      updated_at: "2026-04-19T09:00:00.000Z",
      created_at: "2026-04-19T08:00:00.000Z",
    },
  }), "2026-04-19T10:30:00.000Z");

  assert.equal(evaluation.eligible_actions.length, 0);
  assert.equal(evaluation.blocked_reason_code, "awaiting_draft_review");
});

test("EvaluateAccountEligibility still allows auto-approved autopost when manual review drafts are backed up", () => {
  const evaluation = new EvaluateAccountEligibility().execute(buildOverview({
    pending_draft_count: 8,
    next_due_autopost_policy: {
      policy_id: "policy_1",
      generation_mode: "from_trend",
      next_run_after: "2026-04-19T09:00:00.000Z",
      draft_review_mode: "auto_approve",
      auto_queue_publish: true,
      max_pending_manual_review_drafts: 5,
    },
  }), "2026-04-19T10:30:00.000Z");

  assert.equal(evaluation.eligible_actions.length, 1);
  assert.equal(evaluation.eligible_actions[0]?.type, "autopost.execute_policy");
});

test("EvaluateAccountEligibility uses manual-review backlog instead of total pending drafts for brief-backed work", () => {
  const evaluation = new EvaluateAccountEligibility().execute(buildOverview({
    pending_draft_count: 9,
    pending_manual_review_draft_count: 2,
    pending_auto_approve_draft_count: 7,
    latest_ready_brief_without_draft: {
      brief_id: "brief_1",
      generation_mode: "from_trend",
      topic: "topic",
      updated_at: "2026-04-19T09:00:00.000Z",
      created_at: "2026-04-19T08:00:00.000Z",
    },
  }), "2026-04-19T10:30:00.000Z");

  assert.equal(evaluation.eligible_actions.length, 1);
  assert.equal(evaluation.eligible_actions[0]?.type, "draft.generate.from_brief");
});

test("EvaluateAccountEligibility blocks manual-review autopost when manual-review backlog reaches threshold even if most pending drafts are auto-approved", () => {
  const evaluation = new EvaluateAccountEligibility().execute(buildOverview({
    pending_draft_count: 9,
    pending_manual_review_draft_count: 5,
    pending_auto_approve_draft_count: 4,
    next_due_autopost_policy: {
      policy_id: "policy_1",
      generation_mode: "from_trend",
      next_run_after: "2026-04-19T09:00:00.000Z",
      draft_review_mode: "manual",
      auto_queue_publish: false,
      max_pending_manual_review_drafts: 5,
    },
  }), "2026-04-19T10:30:00.000Z");

  assert.equal(evaluation.eligible_actions.length, 0);
  assert.equal(evaluation.blocked_reason_code, "awaiting_draft_review");
});

test("EvaluateAccountEligibility uses policy max pending manual-review drafts instead of the default threshold", () => {
  const evaluation = new EvaluateAccountEligibility().execute(buildOverview({
    pending_draft_count: 9,
    pending_manual_review_draft_count: 3,
    max_pending_manual_review_drafts: 3,
    next_due_autopost_policy: {
      policy_id: "policy_1",
      generation_mode: "from_trend",
      next_run_after: "2026-04-19T09:00:00.000Z",
      draft_review_mode: "manual",
      auto_queue_publish: false,
      max_pending_manual_review_drafts: 3,
    },
  }), "2026-04-19T10:30:00.000Z");

  assert.equal(evaluation.eligible_actions.length, 0);
  assert.equal(evaluation.blocked_reason_code, "awaiting_draft_review");
  assert.match(evaluation.rationale, /3\/3/);
});

test("EvaluateAccountEligibility allows manual-review autopost below the policy backlog threshold", () => {
  const evaluation = new EvaluateAccountEligibility().execute(buildOverview({
    pending_draft_count: 9,
    pending_manual_review_draft_count: 3,
    max_pending_manual_review_drafts: 4,
    next_due_autopost_policy: {
      policy_id: "policy_1",
      generation_mode: "from_trend",
      next_run_after: "2026-04-19T09:00:00.000Z",
      draft_review_mode: "manual",
      auto_queue_publish: false,
      max_pending_manual_review_drafts: 4,
    },
  }), "2026-04-19T10:30:00.000Z");

  assert.equal(evaluation.eligible_actions.length, 1);
  assert.equal(evaluation.eligible_actions[0]?.type, "autopost.execute_policy");
});

test("EvaluateAccountEligibility includes engagement reply generation when an open thread has no proposal", () => {
  const evaluation = new EvaluateAccountEligibility().execute(buildOverview({
    next_reply_candidate_thread: {
      thread_id: "thread_1",
      channel: "mention",
      classification: "normal",
      status: "open",
      last_message_at: "2026-04-19T10:00:00.000Z",
    },
  }), "2026-04-19T10:30:00.000Z");

  assert.equal(evaluation.eligible_actions.length, 1);
  assert.equal(evaluation.eligible_actions[0]?.type, "engagement.reply.generate");
});

test("EvaluateAccountEligibility prioritizes engagement classification before reply generation for the same account", () => {
  const evaluation = new EvaluateAccountEligibility().execute(buildOverview({
    next_classification_candidate_thread: {
      thread_id: "thread_classify",
      channel: "dm",
      classification: "normal",
      status: "open",
      last_message_at: "2026-04-19T10:05:00.000Z",
    },
    next_reply_candidate_thread: {
      thread_id: "thread_reply",
      channel: "mention",
      classification: "normal",
      status: "open",
      last_message_at: "2026-04-19T10:00:00.000Z",
    },
  }), "2026-04-19T10:30:00.000Z");

  assert.equal(evaluation.eligible_actions.length, 2);
  assert.equal(evaluation.eligible_actions[0]?.type, "engagement.classify");
  assert.equal(evaluation.eligible_actions[0]?.priority_score, 90);
});

test("EvaluateAccountEligibility reports engagement_policy_missing when open threads exist without a configured policy", () => {
  const evaluation = new EvaluateAccountEligibility().execute(buildOverview({
    engagement_automation: {
      policy_status: "not_configured",
      open_thread_count: 2,
      policy_blocked_open_thread_count: 2,
      pending_review_reply_count: 0,
      approved_reply_pending_send_count: 0,
      today_follow_count: 0,
      today_repost_count: 0,
      today_comment_count: 0,
      today_reply_count: 0,
    },
  }), "2026-04-19T10:30:00.000Z");

  assert.equal(evaluation.eligible_actions.length, 0);
  assert.equal(evaluation.blocked_reason_code, "engagement_policy_missing");
});

test("EvaluateAccountEligibility reports engagement_policy_paused when open threads exist under a paused policy", () => {
  const evaluation = new EvaluateAccountEligibility().execute(buildOverview({
    engagement_automation: {
      policy_status: "paused",
      open_thread_count: 1,
      policy_blocked_open_thread_count: 1,
      pending_review_reply_count: 0,
      approved_reply_pending_send_count: 0,
      today_follow_count: 0,
      today_repost_count: 0,
      today_comment_count: 0,
      today_reply_count: 0,
    },
  }), "2026-04-19T10:30:00.000Z");

  assert.equal(evaluation.eligible_actions.length, 0);
  assert.equal(evaluation.blocked_reason_code, "engagement_policy_paused");
});

test("EvaluateAccountEligibility reports engagement_policy_blocks_open_threads when policy excludes every open thread", () => {
  const evaluation = new EvaluateAccountEligibility().execute(buildOverview({
    engagement_automation: {
      policy_status: "active",
      open_thread_count: 3,
      policy_blocked_open_thread_count: 3,
      pending_review_reply_count: 0,
      approved_reply_pending_send_count: 0,
      today_follow_count: 0,
      today_repost_count: 0,
      today_comment_count: 0,
      today_reply_count: 0,
    },
  }), "2026-04-19T10:30:00.000Z");

  assert.equal(evaluation.eligible_actions.length, 0);
  assert.equal(evaluation.blocked_reason_code, "engagement_policy_blocks_open_threads");
});

test("EvaluateAccountEligibility reports awaiting_reply_review when generated proposals are pending manual approval", () => {
  const evaluation = new EvaluateAccountEligibility().execute(buildOverview({
    engagement_automation: {
      policy_status: "active",
      open_thread_count: 1,
      policy_blocked_open_thread_count: 0,
      pending_review_reply_count: 1,
      approved_reply_pending_send_count: 0,
      today_follow_count: 0,
      today_repost_count: 0,
      today_comment_count: 0,
      today_reply_count: 0,
    },
  }), "2026-04-19T10:30:00.000Z");

  assert.equal(evaluation.eligible_actions.length, 0);
  assert.equal(evaluation.blocked_reason_code, "awaiting_reply_review");
});

test("EvaluateAccountEligibility reports awaiting_reply_send when approved reply proposals are pending", () => {
  const evaluation = new EvaluateAccountEligibility().execute(buildOverview({
    engagement_automation: {
      policy_status: "active",
      open_thread_count: 1,
      policy_blocked_open_thread_count: 0,
      pending_review_reply_count: 0,
      approved_reply_pending_send_count: 1,
      today_follow_count: 0,
      today_repost_count: 0,
      today_comment_count: 0,
      today_reply_count: 0,
    },
  }), "2026-04-19T10:30:00.000Z");

  assert.equal(evaluation.eligible_actions.length, 0);
  assert.equal(evaluation.blocked_reason_code, "awaiting_reply_send");
});

test("EvaluateAccountEligibility filters out invalid self-targeted engagement actions while keeping valid ones", () => {
  const evaluation = new EvaluateAccountEligibility().execute(buildOverview({
    engagement_automation: {
      policy_body: {
        allowed_channels: ["mention", "reply"],
        blocked_classifications: ["spam"],
        require_manual_approval: false,
        auto_follow: {
          enabled: true,
          max_per_day: 10,
          rules: [{ type: "keyword", value: "@WuBlockchain" }],
        },
        auto_retweet: {
          enabled: true,
          max_per_day: 3,
          min_likes: 0,
          whitelist: ["@acct_1"],
          keywords: [],
          delay_min_minutes: 0,
          delay_max_minutes: 0,
          quote_tweet_enabled: false,
        },
        auto_comment: {
          enabled: true,
          max_per_day: 5,
          target_handles: ["@acct_1"],
          style: "supportive",
          mode: "latest",
        },
        auto_reply: {
          enabled: false,
          max_per_day: 0,
          trigger_types: ["mention"],
          only_followers: false,
          style: "grateful",
        },
      },
      policy_status: "active",
      open_thread_count: 0,
      policy_blocked_open_thread_count: 0,
      pending_review_reply_count: 0,
      approved_reply_pending_send_count: 0,
      today_follow_count: 0,
      today_repost_count: 0,
      today_comment_count: 0,
      today_reply_count: 0,
    },
  }), "2026-04-19T10:30:00.000Z");

  assert.deepEqual(
    evaluation.eligible_actions.map((action) => action.type),
    ["engagement.follow.execute"],
  );
});
