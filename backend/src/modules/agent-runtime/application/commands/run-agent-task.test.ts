import test from "node:test";
import assert from "node:assert/strict";
import { AppError } from "../../../../core/errors/app-error";
import { createAgentTask, type AgentTask } from "../../domain/agent-task";
import { RunAgentTask } from "./run-agent-task";

test("RunAgentTask fails the linked autopost run when an autopost content task fails", async () => {
  const savedTasks: AgentTask[] = [];
  const savedRunStatuses: string[] = [];
  const failedAutopostRuns: Array<{ runId: string; errorCode: string; errorMessage: string }> = [];
  const task = createAgentTask({
    id: "task_1",
    workspace_id: "ws_1",
    agent_definition_id: "def_1",
    task_type: "content_brief.generate",
    target_type: "account",
    target_id: "acct_1",
    payload: JSON.stringify({
      brief_id: "brief_1",
      automation: {
        kind: "autopost",
        policy_id: "policy_1",
        run_id: "autopost_run_1",
      },
    }),
    created_at: "2026-04-21T10:00:00.000Z",
  });

  const command = new RunAgentTask({
    runtime: {
      findTaskById: async () => task,
      findDefinitionById: async () => ({
        id: "def_1",
        code: "brief-builder",
        version: "v1",
        is_active: true,
      }),
      findLatestRunByTaskId: async () => null,
      createRun: async () => undefined,
      createModelRequest: async () => undefined,
      createModelRequestAttempt: async () => undefined,
      saveRun: async (run: { status: string }) => {
        savedRunStatuses.push(run.status);
      },
      saveTask: async (nextTask: AgentTask) => {
        savedTasks.push(nextTask);
      },
      saveModelRequest: async () => undefined,
    } as never,
    accounts: {
      findById: async () => null,
    } as never,
    contentBriefs: {
      findBriefById: async () => ({
        id: "brief_1",
      }),
    } as never,
    personas: {} as never,
    trends: {} as never,
    sources: {} as never,
    accountSourceDocuments: {} as never,
    drafts: {} as never,
    versions: {} as never,
    engagement: {} as never,
    artifactStore: {
      writeText: async () => undefined,
    } as never,
    auditLogs: {
      append: async () => undefined,
    } as never,
    alerts: {
      create: async () => undefined,
    } as never,
    autopostRuns: {
      findActiveByTaskId: async (taskId: string) => taskId === "task_1"
        ? { id: "autopost_run_1" }
        : null,
    } as never,
    failAutopostRun: {
      execute: async (runId: string, errorCode: string, errorMessage: string) => {
        failedAutopostRuns.push({ runId, errorCode, errorMessage });
      },
    } as never,
    queueAccountAutomationTick: {
      execute: async () => undefined,
    } as never,
    queueSendReplyProposalJob: {
      execute: async () => undefined,
    } as never,
    engagementPolicies: {} as never,
    modelGateway: {
      describe: () => ({
        provider: "test",
        model_name: "test-model",
      }),
    } as never,
    clock: {
      now: () => new Date("2026-04-21T10:05:00.000Z"),
    },
  });

  await assert.rejects(async () => {
    await command.execute("task_1");
  }, (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.code, "NOT_FOUND");
    assert.match(error.message, /account not found/);
    return true;
  });

  assert.equal(savedTasks[0]?.status, "running");
  assert.equal(savedTasks[1]?.status, "failed");
  assert.ok(savedRunStatuses.includes("failed"));
  assert.deepEqual(failedAutopostRuns, [{
    runId: "autopost_run_1",
    errorCode: "NOT_FOUND",
    errorMessage: "account not found",
  }]);
});

test("RunAgentTask queues reply send jobs only when reply policy skips manual approval", async () => {
  const autoQueued = await runReplyProposerTask({ requireManualApproval: false });
  assert.equal(autoQueued.savedProposals.length, 1);
  assert.equal(autoQueued.savedProposals[0]?.status, "pending_review");
  assert.deepEqual(autoQueued.queuedSendProposalIds, [autoQueued.savedProposals[0]?.id]);

  const manualReview = await runReplyProposerTask({ requireManualApproval: true });
  assert.equal(manualReview.savedProposals.length, 1);
  assert.equal(manualReview.savedProposals[0]?.status, "pending_review");
  assert.deepEqual(manualReview.queuedSendProposalIds, []);
});

async function runReplyProposerTask(input: { requireManualApproval: boolean }) {
  const savedProposals: Array<{ id: string; status: string }> = [];
  const queuedSendProposalIds: string[] = [];
  const task = createAgentTask({
    id: `reply_task_${input.requireManualApproval ? "manual" : "auto"}`,
    workspace_id: "ws_1",
    agent_definition_id: "agent-def-reply-proposer",
    task_type: "engagement.reply_propose",
    target_type: "engagement_thread",
    target_id: "thread_1",
    payload: JSON.stringify({
      thread_id: "thread_1",
      account_id: "acct_1",
      preferred_style: "brief",
    }),
    created_at: "2026-04-21T10:00:00.000Z",
  });

  const command = new RunAgentTask({
    runtime: {
      findTaskById: async () => task,
      findDefinitionById: async () => ({
        id: "agent-def-reply-proposer",
        code: "reply-proposer",
        version: "v1",
        is_active: true,
      }),
      findLatestRunByTaskId: async () => null,
      createRun: async () => undefined,
      createModelRequest: async () => undefined,
      createModelRequestAttempt: async () => undefined,
      createToolCall: async () => undefined,
      saveRun: async () => undefined,
      saveTask: async () => undefined,
      saveModelRequest: async () => undefined,
    } as never,
    accounts: {} as never,
    contentBriefs: {} as never,
    personas: {} as never,
    trends: {} as never,
    sources: {} as never,
    accountSourceDocuments: {} as never,
    drafts: {} as never,
    versions: {} as never,
    engagement: {
      findThreadById: async () => ({
        id: "thread_1",
        workspace_id: "ws_1",
        account_id: "acct_1",
        channel: "reply",
        counterpart_handle: "@user",
        external_thread_id: "post_1",
        status: "open",
        classification: "normal",
        last_message_at: "2026-04-21T09:59:00.000Z",
        created_at: "2026-04-21T09:59:00.000Z",
      }),
      listMessagesByThreadId: async () => ([{
        id: "message_1",
        thread_id: "thread_1",
        external_message_id: "post_1",
        direction: "incoming",
        sender_handle: "@user",
        content: "hello",
        raw_payload: "{}",
        created_at: "2026-04-21T09:59:00.000Z",
      }]),
      saveReplyProposal: async (proposal: { id: string; status: string }) => {
        savedProposals.push({ id: proposal.id, status: proposal.status });
      },
      saveThread: async () => undefined,
    } as never,
    artifactStore: {
      writeText: async () => undefined,
    } as never,
    auditLogs: {
      append: async () => undefined,
    } as never,
    alerts: {
      create: async () => undefined,
    } as never,
    autopostRuns: {
      findActiveByTaskId: async () => null,
    } as never,
    failAutopostRun: {
      execute: async () => undefined,
    } as never,
    queueAccountAutomationTick: {
      execute: async () => undefined,
    } as never,
    queueSendReplyProposalJob: {
      execute: async (proposalId: string) => {
        queuedSendProposalIds.push(proposalId);
      },
    } as never,
    engagementPolicies: {
      findByAccountId: async () => ({
        id: "policy_1",
        workspace_id: "ws_1",
        account_id: "acct_1",
        status: "active",
        updated_at: "2026-04-21T10:00:00.000Z",
        policy_body: {
          allowed_channels: ["reply"],
          blocked_classifications: ["spam"],
          require_manual_approval: input.requireManualApproval,
          auto_reply: {
            enabled: true,
            max_per_day: 10,
            trigger_types: ["reply"],
            only_followers: false,
            style: "brief",
          },
        },
      }),
    } as never,
    modelGateway: {
      describe: () => ({
        provider: "test",
        model_name: "test-model",
      }),
      proposeReply: async () => ({
        provider_request_id: "provider_reply_1",
        content: "Thanks for reaching out.",
        rationale: "short reply",
      }),
    } as never,
    clock: {
      now: () => new Date("2026-04-21T10:05:00.000Z"),
    },
  });

  await command.execute(task.id);

  return { savedProposals, queuedSendProposalIds };
}
