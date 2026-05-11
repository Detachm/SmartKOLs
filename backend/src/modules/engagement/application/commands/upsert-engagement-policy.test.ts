import test from "node:test";
import assert from "node:assert/strict";
import { AppError } from "../../../../core/errors/app-error";
import { UpsertEngagementPolicy } from "./upsert-engagement-policy";

function buildCommand(overrides: {
  save?: (policy: unknown) => Promise<void>;
  queue?: (input: { account_id: string; trigger_kind: string; create_if_missing: boolean }) => Promise<void>;
} = {}) {
  return new UpsertEngagementPolicy({
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
      listActive: async () => [],
      save: overrides.save ?? (async () => undefined),
    },
    queueAccountAutomationTick: {
      execute: overrides.queue ?? (async () => undefined),
    } as any,
    auditLogs: {
      append: async () => undefined,
    } as any,
    clock: {
      now: () => new Date("2026-04-19T10:30:00.000Z"),
    },
  });
}

test("UpsertEngagementPolicy queues orchestration tick when policy becomes active", async () => {
  const queued: Array<{ account_id: string; trigger_kind: string; create_if_missing: boolean }> = [];
  const savedPolicies: any[] = [];

  const command = buildCommand({
    save: async (policy: unknown) => {
      savedPolicies.push(policy);
    },
    queue: async (input: { account_id: string; trigger_kind: string; create_if_missing: boolean }) => {
      queued.push(input);
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

  const command = buildCommand({
    queue: async (input: { account_id: string; trigger_kind: string; create_if_missing: boolean }) => {
      queued.push(input);
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

test("UpsertEngagementPolicy rejects auto comment configs that only target the same account", async () => {
  let saved = false;
  const command = buildCommand({
    save: async () => {
      saved = true;
    },
  });

  await assert.rejects(async () => {
    await command.execute({
      account_id: "acct_1",
      policy_body: {
        allowed_channels: ["mention", "dm"],
        blocked_classifications: ["spam"],
        require_manual_approval: true,
        auto_comment: {
          enabled: true,
          max_per_day: 5,
          target_handles: ["@acct"],
          style: "supportive",
          mode: "latest",
        },
      },
      status: "active",
    });
  }, (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.code, "VALIDATION_ERROR");
    assert.match(error.message, /auto comment targets/);
    return true;
  });

  assert.equal(saved, false);
});

test("UpsertEngagementPolicy rejects auto repost configs without an external target or keyword", async () => {
  const command = buildCommand();

  await assert.rejects(async () => {
    await command.execute({
      account_id: "acct_1",
      policy_body: {
        allowed_channels: ["mention", "dm"],
        blocked_classifications: ["spam"],
        require_manual_approval: true,
        auto_retweet: {
          enabled: true,
          max_per_day: 3,
          min_likes: 0,
          whitelist: ["@acct"],
          keywords: [],
          delay_min_minutes: 30,
          delay_max_minutes: 120,
          quote_tweet_enabled: false,
        },
      },
      status: "paused",
    });
  }, (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.code, "VALIDATION_ERROR");
    assert.match(error.message, /auto repost config/);
    return true;
  });
});

test("UpsertEngagementPolicy rejects auto follow rules without an external handle or keyword", async () => {
  const command = buildCommand();

  await assert.rejects(async () => {
    await command.execute({
      account_id: "acct_1",
      policy_body: {
        allowed_channels: ["mention", "dm"],
        blocked_classifications: ["spam"],
        require_manual_approval: true,
        auto_follow: {
          enabled: true,
          max_per_day: 10,
          rules: [{ type: "keyword", value: "@acct" }],
        },
      },
      status: "paused",
    });
  }, (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.code, "VALIDATION_ERROR");
    assert.match(error.message, /auto follow rules/);
    return true;
  });
});
