import test from "node:test";
import assert from "node:assert/strict";
import {
  reconcileAccountAutomationTickWorkerJobs,
  resolveNextAccountAutomationTickAfter,
} from "./reconcile-account-automation-tick-worker-jobs";

test("reconcileAccountAutomationTickWorkerJobs queues due active automation accounts", async () => {
  const queued: Array<{ account_id: string; run_after?: string; create_if_missing?: boolean }> = [];

  const result = await reconcileAccountAutomationTickWorkerJobs({
    states: {
      findByAccountId: async () => null,
      save: async () => undefined,
      listDueAutomationTickCandidates: async (input: { now: string; stale_before: string; limit: number }) => {
        assert.equal(input.now, "2026-04-21T10:00:00.000Z");
        assert.equal(input.stale_before, "2026-04-21T09:30:00.000Z");
        assert.equal(input.limit, 2);
        return [{
          account_id: "acct_1",
          workspace_id: "ws_1",
        }, {
          account_id: "acct_2",
          workspace_id: "ws_1",
          next_tick_after: "2026-04-21T09:55:00.000Z",
        }];
      },
    },
    queueAccountAutomationTick: {
      execute: async (input: { account_id: string; run_after?: string; create_if_missing?: boolean }) => {
        queued.push(input);
        return null;
      },
    } as never,
    clock: {
      now: () => new Date("2026-04-21T10:00:00.000Z"),
    },
    limit: 2,
  });

  assert.equal(result.queued, 2);
  assert.deepEqual(queued, [{
    account_id: "acct_1",
    trigger_kind: "system",
    create_if_missing: true,
    run_after: "2026-04-21T10:00:00.000Z",
  }, {
    account_id: "acct_2",
    trigger_kind: "system",
    create_if_missing: true,
    run_after: "2026-04-21T10:00:00.000Z",
  }]);
});

test("resolveNextAccountAutomationTickAfter uses the default runtime heartbeat interval", () => {
  assert.equal(
    resolveNextAccountAutomationTickAfter("2026-04-21T10:00:00.000Z"),
    "2026-04-21T10:30:00.000Z",
  );
});
