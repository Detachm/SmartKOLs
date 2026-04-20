import test from "node:test";
import assert from "node:assert/strict";
import { SendReplyProposal } from "./send-reply-proposal";

test("SendReplyProposal queues orchestration tick after a successful platform send", async () => {
  const queued: Array<{ account_id: string; trigger_kind: string; create_if_missing: boolean }> = [];

  const command = new SendReplyProposal({
    engagement: {
      findReplyProposalById: async () => ({
        id: "proposal_1",
        workspace_id: "ws_1",
        account_id: "acct_1",
        thread_id: "thread_1",
        agent_task_id: "task_1",
        agent_run_id: "run_1",
        content: "reply text",
        rationale: "reply rationale",
        status: "approved",
        created_at: "2026-04-19T10:00:00.000Z",
      }),
      findThreadById: async () => ({
        id: "thread_1",
        workspace_id: "ws_1",
        account_id: "acct_1",
        channel: "mention",
        external_thread_id: "post_123",
        classification: "normal",
        status: "open",
        last_message_at: "2026-04-19T10:00:00.000Z",
        created_at: "2026-04-19T10:00:00.000Z",
      }),
      saveReplyProposal: async () => undefined,
      createMessage: async () => undefined,
      saveThread: async () => undefined,
    } as any,
    policies: {
      findByAccountId: async () => ({
        id: "policy_1",
        workspace_id: "ws_1",
        account_id: "acct_1",
        policy_body: {
          allowed_channels: ["mention", "reply", "dm", "comment"],
          blocked_classifications: [],
          require_manual_approval: true,
        },
        status: "active",
        updated_at: "2026-04-19T10:00:00.000Z",
      }),
    } as any,
    accounts: {
      findById: async () => ({
        id: "acct_1",
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
    replyToPost: {
      execute: async () => ({
        connector_request_id: "conn_1",
        external_reply_id: "reply_1",
        external_reply_url: "https://x.com/reply/1",
        external_thread_id: "thread_ext_1",
      }),
    } as any,
    sendDirectMessage: {
      execute: async () => {
        throw new Error("dm path should not be used in this test");
      },
    } as any,
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

  await command.execute("proposal_1");

  assert.deepEqual(queued, [{
    account_id: "acct_1",
    trigger_kind: "system",
    create_if_missing: true,
  }]);
});
