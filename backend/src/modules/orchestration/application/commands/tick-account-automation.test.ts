import test from "node:test";
import assert from "node:assert/strict";
import { AppError } from "../../../../core/errors/app-error";
import { TickAccountAutomation } from "./tick-account-automation";

function buildAccount() {
  return {
    id: "acct_1",
    workspace_id: "ws_1",
    platform: "x",
    handle: "@acct",
    display_name: "Acct",
    status: "active",
    follower_count: 0,
    following_count: 0,
    post_count: 0,
    created_at: "2026-04-21T09:00:00.000Z",
    updated_at: "2026-04-21T09:00:00.000Z",
  };
}

test("TickAccountAutomation isolates engagement execution failures and requeues transient retries", async () => {
  const savedRuns: Array<{ status: string; chosen_action_json?: string; error_code?: string }> = [];
  const savedStates: Array<{ last_decision_type?: string; last_reason_code?: string; next_tick_after?: string }> = [];
  const queuedTicks: Array<{ account_id: string; run_after?: string }> = [];
  const alerts: string[] = [];
  const audits: string[] = [];

  const command = new TickAccountAutomation({
    accounts: {
      findById: async () => buildAccount(),
    } as never,
    states: {
      findByAccountId: async () => null,
      save: async (state: { last_decision_type?: string; last_reason_code?: string; next_tick_after?: string }) => {
        savedStates.push(state);
      },
    } as never,
    runs: {
      create: async () => undefined,
      save: async (run: { status: string; chosen_action_json?: string; error_code?: string }) => {
        savedRuns.push(run);
      },
    } as never,
    overviews: {
      getAccountAutomationOverview: async () => ({
        account_id: "acct_1",
        workspace_id: "ws_1",
        has_active_automation: true,
        pending_draft_count: 0,
        queued_or_running_content_tasks: [],
        engagement_automation: {
          policy_status: "active",
          open_thread_count: 0,
          policy_blocked_open_thread_count: 0,
          pending_review_reply_count: 0,
          approved_reply_pending_send_count: 0,
          today_follow_count: 0,
          today_repost_count: 0,
          today_comment_count: 0,
          today_reply_count: 0,
          policy_body: {
            allowed_channels: ["mention"],
            blocked_classifications: ["spam"],
            require_manual_approval: true,
            auto_follow: { enabled: true, max_per_day: 5, rules: [{ type: "keyword", value: "btc" }] },
          },
        },
      }),
    } as never,
    eligibility: {
      execute: () => ({
        eligible_actions: [{
          type: "engagement.follow.execute" as const,
          account_id: "acct_1",
          rationale: "follow is due",
          priority_score: 50,
        }],
        rationale: "engagement is due",
      }),
    } as never,
    chief: {
      decide: () => ({
        type: "engagement.follow.execute" as const,
        account_id: "acct_1",
        rationale: "follow is due",
        priority_score: 50,
      }),
    } as never,
    applier: {
      execute: async () => {
        throw new AppError("EXTERNAL_DEPENDENCY_ERROR", "x api temporarily unavailable");
      },
    } as never,
    queueAccountAutomationTick: {
      execute: async (input: { account_id: string; run_after?: string }) => {
        queuedTicks.push(input);
        return null;
      },
    } as never,
    alerts: {
      create: async (alert: { code: string }) => {
        alerts.push(alert.code);
      },
    } as never,
    auditLogs: {
      append: async (entry: { action: string }) => {
        audits.push(entry.action);
      },
    } as never,
    clock: {
      now: () => new Date("2026-04-21T10:00:00.000Z"),
    },
  });

  const result = await command.execute({
    account_id: "acct_1",
    trigger_kind: "system",
  });

  assert.equal(result.account_id, "acct_1");
  assert.ok(result.decision);
  assert.equal(result.decision.type, "engagement.follow.execute");
  assert.equal(savedRuns.at(-1)?.status, "failed");
  assert.equal(savedRuns.at(-1)?.error_code, "EXTERNAL_DEPENDENCY_ERROR");
  assert.match(savedRuns.at(-1)?.chosen_action_json ?? "", /engagement\.follow\.execute/);
  assert.equal(savedStates.at(-1)?.last_decision_type, "engagement.follow.execute");
  assert.equal(savedStates.at(-1)?.last_reason_code, undefined);
  assert.ok(savedStates.at(-1)?.next_tick_after);
  assert.equal(queuedTicks.length, 1);
  assert.deepEqual(alerts, ["orchestration.run.action_failed"]);
  assert.deepEqual(audits, ["orchestration_run.failed_isolated"]);
});

test("TickAccountAutomation still throws for content-path failures", async () => {
  const savedStates: Array<{ last_reason_code?: string }> = [];

  const command = new TickAccountAutomation({
    accounts: {
      findById: async () => buildAccount(),
    } as never,
    states: {
      findByAccountId: async () => null,
      save: async (state: { last_reason_code?: string }) => {
        savedStates.push(state);
      },
    } as never,
    runs: {
      create: async () => undefined,
      save: async () => undefined,
    } as never,
    overviews: {
      getAccountAutomationOverview: async () => ({
        account_id: "acct_1",
        workspace_id: "ws_1",
        has_active_automation: true,
        pending_draft_count: 0,
        queued_or_running_content_tasks: [],
        engagement_automation: {
          policy_status: "not_configured",
          open_thread_count: 0,
          policy_blocked_open_thread_count: 0,
          pending_review_reply_count: 0,
          approved_reply_pending_send_count: 0,
          today_follow_count: 0,
          today_repost_count: 0,
          today_comment_count: 0,
          today_reply_count: 0,
        },
      }),
    } as never,
    eligibility: {
      execute: () => ({
        eligible_actions: [{
          type: "autopost.execute_policy" as const,
          account_id: "acct_1",
          policy_id: "policy_1",
          rationale: "autopost due",
          priority_score: 100,
        }],
        rationale: "autopost due",
      }),
    } as never,
    chief: {
      decide: () => ({
        type: "autopost.execute_policy" as const,
        account_id: "acct_1",
        policy_id: "policy_1",
        rationale: "autopost due",
        priority_score: 100,
      }),
    } as never,
    applier: {
      execute: async () => {
        throw new AppError("EXTERNAL_DEPENDENCY_ERROR", "brief generation upstream failed");
      },
    } as never,
    queueAccountAutomationTick: {
      execute: async () => null,
    } as never,
    alerts: {
      create: async () => undefined,
    } as never,
    auditLogs: {
      append: async () => undefined,
    } as never,
    clock: {
      now: () => new Date("2026-04-21T10:00:00.000Z"),
    },
  });

  await assert.rejects(async () => {
    await command.execute({
      account_id: "acct_1",
      trigger_kind: "system",
    });
  }, (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.code, "EXTERNAL_DEPENDENCY_ERROR");
    return true;
  });

  assert.equal(savedStates.at(-1)?.last_reason_code, "tick_failed");
});
