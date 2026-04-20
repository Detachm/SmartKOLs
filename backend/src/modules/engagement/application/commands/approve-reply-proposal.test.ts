import test from "node:test";
import assert from "node:assert/strict";
import { ApproveReplyProposal } from "./approve-reply-proposal";

test("ApproveReplyProposal queues orchestration tick after approval", async () => {
  const queued: Array<{ account_id: string; trigger_kind: string; create_if_missing: boolean }> = [];
  const queuedSendJobs: string[] = [];

  const command = new ApproveReplyProposal({
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
        status: "pending_review",
        created_at: "2026-04-19T10:00:00.000Z",
      }),
      saveReplyProposal: async () => undefined,
    } as any,
    queueSendReplyProposalJob: {
      execute: async (proposalId: string) => {
        queuedSendJobs.push(proposalId);
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

  assert.deepEqual(queuedSendJobs, ["proposal_1"]);
  assert.deepEqual(queued, [{
    account_id: "acct_1",
    trigger_kind: "system",
    create_if_missing: true,
  }]);
});
