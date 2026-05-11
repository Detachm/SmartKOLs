import test from "node:test";
import assert from "node:assert/strict";
import { PauseAccountAutomation } from "./pause-account-automation";
import { ResumeAccountAutomation } from "./resume-account-automation";
import type { Account } from "../../../accounts/domain/account";
import type { AccountOrchestrationState } from "../../domain/account-orchestration-state";
import type { AccountOrchestrationStatesRepository } from "../ports/account-orchestration-states-repository";

const fixedNow = new Date("2026-04-19T12:00:00.000Z");

function buildAccount(): Account {
  return {
    id: "acct_1",
    workspace_id: "ws_1",
    platform: "x",
    handle: "@chief",
    display_name: "Chief",
    status: "active",
    follower_count: 0,
    following_count: 0,
    post_count: 0,
    created_at: "2026-04-19T10:00:00.000Z",
    updated_at: "2026-04-19T10:00:00.000Z",
  };
}

class InMemoryStatesRepository implements AccountOrchestrationStatesRepository {
  state: AccountOrchestrationState | null = null;

  async findByAccountId(): Promise<AccountOrchestrationState | null> {
    return this.state;
  }

  async listDueAutomationTickCandidates() {
    return [];
  }

  async save(state: AccountOrchestrationState): Promise<void> {
    this.state = state;
  }
}

test("PauseAccountAutomation clears queued tick state and persists paused status", async () => {
  const states = new InMemoryStatesRepository();
  states.state = {
    account_id: "acct_1",
    workspace_id: "ws_1",
    status: "active",
    next_tick_after: "2026-04-19T12:30:00.000Z",
    active_run_id: "run_1",
    created_at: "2026-04-19T10:00:00.000Z",
    updated_at: "2026-04-19T11:00:00.000Z",
  };
  const auditEntries: Array<{ action: string }> = [];

  const command = new PauseAccountAutomation({
    accounts: { findById: async () => buildAccount() } as never,
    states,
    auditLogs: { append: async (entry: { action: string }) => void auditEntries.push(entry) } as never,
    clock: { now: () => fixedNow },
  });

  const state = await command.execute("acct_1");
  assert.equal(state.status, "paused");
  assert.equal(state.next_tick_after, undefined);
  assert.equal(state.active_run_id, undefined);
  assert.deepEqual(auditEntries.map((entry) => entry.action), ["account_automation.paused"]);
});

test("ResumeAccountAutomation reactivates orchestration and queues a fresh tick", async () => {
  const states = new InMemoryStatesRepository();
  states.state = {
    account_id: "acct_1",
    workspace_id: "ws_1",
    status: "paused",
    created_at: "2026-04-19T10:00:00.000Z",
    updated_at: "2026-04-19T11:00:00.000Z",
  };
  const queued: Array<{ account_id: string; trigger_kind: string; create_if_missing: boolean }> = [];

  const command = new ResumeAccountAutomation({
    accounts: { findById: async () => buildAccount() } as never,
    states,
    auditLogs: { append: async () => undefined } as never,
    queueAccountAutomationTick: {
      execute: async (input: { account_id: string; trigger_kind: string; create_if_missing: boolean }) => {
        queued.push(input);
        return null;
      },
    } as never,
    clock: { now: () => fixedNow },
  });

  const state = await command.execute("acct_1");
  assert.equal(state.status, "active");
  assert.deepEqual(queued, [{
    account_id: "acct_1",
    trigger_kind: "manual",
    create_if_missing: true,
  }]);
});
