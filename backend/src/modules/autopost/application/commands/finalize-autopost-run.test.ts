import test from "node:test";
import assert from "node:assert/strict";
import { FinalizeAutopostRun } from "./finalize-autopost-run";

function buildCommand(input?: {
  draftReviewMode?: "manual" | "auto_approve";
  autoQueuePublish?: boolean;
  onApproveDraft?: () => void;
  onScheduleDraft?: () => void;
  onQueuePublishJob?: () => void;
}) {
  return new FinalizeAutopostRun({
    runtime: {
      findLatestRunByTaskId: async (taskId: string) => ({
        id: "agent_run_1",
        task_id: taskId,
      }),
    } as never,
    policies: {
      findById: async () => ({
        id: "policy_1",
        workspace_id: "ws_1",
        account_id: "acct_1",
        cadence_body: {
          timezone: "UTC",
          weekday_codes: ["mon"],
          slot_times: ["09:00"],
          min_spacing_minutes: 60,
        },
        content_strategy_body: {
          generation_mode: "from_source_scope",
          source_types: ["website"],
          max_source_age_days: 7,
        },
        execution_body: {
          draft_review_mode: input?.draftReviewMode ?? "manual",
          auto_queue_publish: input?.autoQueuePublish ?? false,
        },
        status: "active",
        updated_at: "2026-04-19T10:00:00.000Z",
      }),
      save: async () => undefined,
    } as never,
    runs: {
      findById: async () => ({
        id: "run_1",
        policy_id: "policy_1",
        workspace_id: "ws_1",
        account_id: "acct_1",
        generation_mode: "from_source_scope",
        source_scope: "{}",
        scheduled_for: "2026-04-19T12:00:00.000Z",
        draft_task_id: "task_1",
        status: "draft_generating",
        created_at: "2026-04-19T10:00:00.000Z",
        updated_at: "2026-04-19T10:30:00.000Z",
      }),
      save: async () => undefined,
    } as never,
    drafts: {
      findByGeneratedRunId: async (runId: string) => ({
        id: runId === "agent_run_1" ? "draft_1" : "unexpected",
        workspace_id: "ws_1",
        account_id: "acct_1",
        status: "pending",
        topic: "topic",
        generated_by_run_id: runId,
        created_at: "2026-04-19T10:30:00.000Z",
        updated_at: "2026-04-19T10:30:00.000Z",
      }),
    } as never,
    approveDraft: {
      execute: async () => {
        input?.onApproveDraft?.();
      },
    } as never,
    scheduleDraft: {
      execute: async () => {
        input?.onScheduleDraft?.();
        return { id: "schedule_1" };
      },
    } as never,
    queuePublishJob: {
      execute: async () => {
        input?.onQueuePublishJob?.();
        return { id: "publish_job_1" };
      },
    } as never,
    failAutopostRun: { execute: async () => undefined } as never,
    auditLogs: { append: async () => undefined } as never,
    clock: { now: () => new Date("2026-04-19T12:00:00.000Z") },
  });
}

test("FinalizeAutopostRun resolves generated draft id from the latest agent run when the autopost run has no draft_id", async () => {
  const command = buildCommand();

  const result = await command.execute("run_1");
  assert.equal(result.run.status, "awaiting_review");
  assert.equal(result.run.draft_id, "draft_1");
});

test("FinalizeAutopostRun leaves manual-review drafts in operator review and does not schedule", async () => {
  let approved = false;
  let scheduled = false;
  let publishQueued = false;
  const command = buildCommand({
    draftReviewMode: "manual",
    autoQueuePublish: false,
    onApproveDraft: () => {
      approved = true;
    },
    onScheduleDraft: () => {
      scheduled = true;
    },
    onQueuePublishJob: () => {
      publishQueued = true;
    },
  });

  const result = await command.execute("run_1");

  assert.equal(result.run.status, "awaiting_review");
  assert.equal(result.run.draft_id, "draft_1");
  assert.equal(approved, false);
  assert.equal(scheduled, false);
  assert.equal(publishQueued, false);
});

test("FinalizeAutopostRun auto-approves and schedules drafts when auto approval is enabled", async () => {
  let approved = false;
  let scheduled = false;
  let publishQueued = false;
  const command = buildCommand({
    draftReviewMode: "auto_approve",
    autoQueuePublish: false,
    onApproveDraft: () => {
      approved = true;
    },
    onScheduleDraft: () => {
      scheduled = true;
    },
    onQueuePublishJob: () => {
      publishQueued = true;
    },
  });

  const result = await command.execute("run_1");

  assert.equal(result.run.status, "scheduled");
  assert.equal(result.run.draft_id, "draft_1");
  assert.equal(result.run.schedule_id, "schedule_1");
  assert.equal(approved, true);
  assert.equal(scheduled, true);
  assert.equal(publishQueued, false);
});

test("FinalizeAutopostRun queues publish job only when auto approval and auto queue publish are enabled", async () => {
  let approved = false;
  let scheduled = false;
  let publishQueued = false;
  const command = buildCommand({
    draftReviewMode: "auto_approve",
    autoQueuePublish: true,
    onApproveDraft: () => {
      approved = true;
    },
    onScheduleDraft: () => {
      scheduled = true;
    },
    onQueuePublishJob: () => {
      publishQueued = true;
    },
  });

  const result = await command.execute("run_1");

  assert.equal(result.run.status, "publish_queued");
  assert.equal(result.run.draft_id, "draft_1");
  assert.equal(result.run.schedule_id, "schedule_1");
  assert.equal(result.run.publish_job_id, "publish_job_1");
  assert.equal(approved, true);
  assert.equal(scheduled, true);
  assert.equal(publishQueued, true);
});
