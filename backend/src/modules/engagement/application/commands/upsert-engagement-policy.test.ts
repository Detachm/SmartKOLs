import test from "node:test";
import assert from "node:assert/strict";
import { UpsertEngagementPolicy } from "./upsert-engagement-policy";

test("UpsertEngagementPolicy queues orchestration tick when policy becomes active", async () => {
  const queued: Array<{ account_id: string; trigger_kind: string; create_if_missing: boolean }> = [];
  const savedPolicies: any[] = [];

  const command = new UpsertEngagementPolicy({
    accounts: {
      findById: async (id: string) => ({
        id,
        workspace_id: "ws_1",
        platform: "x",
        handle: "@acct",
        display_name: "Acct",
        status: "active",
        follower_count: 0,
        following_count: 0,
        post_count: 0,
        created_at: "2026-04-19T10:00:00.000Z",
        updated_at: "2026-04-19T10:00:00.000Z",
      }),
    } as any,
    policies: {
      findByAccountId: async () => null,
      save: async (policy: unknown) => {
        savedPolicies.push(policy);
      },
    },
    queueAccountAutomationTick: {
      execute: async (input: { account_id: string; trigger_kind: string; create_if_missing: boolean }) => {
        queued.push(input);
      },
    } as any,
    auditLogs: {
      append: async () => undefined,
    } as any,
    clock: {
      now: () => new Date("2026-04-19T10:30:00.000Z"),
    },
  });

  await command.execute({
    account_id: "acct_1",
    policy_body: {
      allowed_channels: ["mention", "dm"],
      blocked_classifications: ["spam"],
      require_manual_approval: true,
    },
    status: "active",
  });

  assert.equal(savedPolicies.length, 1);
  assert.deepEqual(queued, [{
    account_id: "acct_1",
    trigger_kind: "system",
    create_if_missing: true,
  }]);
});

test("UpsertEngagementPolicy does not queue orchestration tick when policy is paused", async () => {
  const queued: Array<{ account_id: string; trigger_kind: string; create_if_missing: boolean }> = [];

  const command = new UpsertEngagementPolicy({
    accounts: {
      findById: async (id: string) => ({
        id,
        workspace_id: "ws_1",
        platform: "x",
        handle: "@acct",
        display_name: "Acct",
        status: "active",
        follower_count: 0,
        following_count: 0,
        post_count: 0,
        created_at: "2026-04-19T10:00:00.000Z",
        updated_at: "2026-04-19T10:00:00.000Z",
      }),
    } as any,
    policies: {
      findByAccountId: async () => null,
      save: async () => undefined,
    },
    queueAccountAutomationTick: {
      execute: async (input: { account_id: string; trigger_kind: string; create_if_missing: boolean }) => {
        queued.push(input);
      },
    } as any,
    auditLogs: {
      append: async () => undefined,
    } as any,
    clock: {
      now: () => new Date("2026-04-19T10:30:00.000Z"),
    },
  });

  await command.execute({
    account_id: "acct_1",
    policy_body: {
      allowed_channels: ["mention", "dm"],
      blocked_classifications: ["spam"],
      require_manual_approval: true,
    },
    status: "paused",
  });

  assert.deepEqual(queued, []);
});
