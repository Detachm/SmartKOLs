import test from "node:test";
import assert from "node:assert/strict";
import { AppError } from "../../../../core/errors/app-error";
import { GetAccountAutomationOverview } from "./get-account-automation-overview";
import { EvaluateAccountEligibility } from "../services/evaluate-account-eligibility";
import { ChiefOrchestrator } from "../services/chief-orchestrator";
import type { AccountAutomationOverview } from "../ports/account-automation-overview-read-model";

function buildOverview(): AccountAutomationOverview {
  return {
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
      next_pending_review_reply: undefined,
      next_approved_reply_pending_send: undefined,
    },
  };
}

test("GetAccountAutomationOverview materializes recent orchestration runs", async () => {
  const query = new GetAccountAutomationOverview({
    readModel: { getAccountAutomationOverview: async () => buildOverview() } as never,
    runs: {
      listRecentByAccountId: async () => [{
        id: "run_1",
        workspace_id: "ws_1",
        account_id: "acct_1",
        trigger_kind: "system",
        eligible_actions_json: JSON.stringify([{
          type: "autopost.execute_policy",
          account_id: "acct_1",
          policy_id: "policy_1",
          rationale: "due",
          priority_score: 150,
        }]),
        chosen_action_json: JSON.stringify({
          type: "autopost.execute_policy",
          account_id: "acct_1",
          policy_id: "policy_1",
          rationale: "due",
          priority_score: 150,
        }),
        status: "succeeded",
        created_at: "2026-04-19T10:00:00.000Z",
        finished_at: "2026-04-19T10:01:00.000Z",
      }],
    } as never,
    eligibility: new EvaluateAccountEligibility(),
    chief: new ChiefOrchestrator(),
    clock: { now: () => new Date("2026-04-19T12:00:00.000Z") },
  });

  const overview = await query.execute("acct_1");
  assert.ok(overview);
  assert.equal(overview?.recent_runs.length, 1);
  assert.equal(overview?.recent_runs[0]?.chosen_action?.type, "autopost.execute_policy");
  assert.equal(overview?.recent_runs[0]?.eligible_actions[0]?.type, "autopost.execute_policy");
});

test("GetAccountAutomationOverview fails explicitly when orchestration history payload is malformed", async () => {
  const query = new GetAccountAutomationOverview({
    readModel: { getAccountAutomationOverview: async () => buildOverview() } as never,
    runs: {
      listRecentByAccountId: async () => [{
        id: "run_bad",
        workspace_id: "ws_1",
        account_id: "acct_1",
        trigger_kind: "system",
        eligible_actions_json: "{bad json",
        chosen_action_json: undefined,
        status: "failed",
        created_at: "2026-04-19T10:00:00.000Z",
      }],
    } as never,
    eligibility: new EvaluateAccountEligibility(),
    chief: new ChiefOrchestrator(),
    clock: { now: () => new Date("2026-04-19T12:00:00.000Z") },
  });

  await assert.rejects(async () => {
    await query.execute("acct_1");
  }, (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.code, "INTERNAL_ERROR");
    assert.match(error.message, /eligible_actions_json is invalid/);
    return true;
  });
});
