import test from "node:test";
import assert from "node:assert/strict";
import { AppError } from "../../../../core/errors/app-error";
import { RequestDraftRegeneration } from "./request-draft-regeneration";

test("RequestDraftRegeneration rejects legacy drafts that do not carry content_brief_id metadata", async () => {
  let createdTask = false;
  let appendedReview = false;
  let appendedAudit = false;
  let queuedTick = false;

  const command = new RequestDraftRegeneration({
    drafts: {
      findById: async () => ({
        id: "draft_1",
        workspace_id: "ws_1",
        account_id: "acct_1",
        current_version_id: "version_1",
        topic: "legacy topic only draft",
        created_at: "2026-04-22T04:00:00.000Z",
        updated_at: "2026-04-22T04:00:00.000Z",
      }),
      appendReview: async () => {
        appendedReview = true;
      },
    } as never,
    versions: {
      findById: async () => ({
        id: "version_1",
        metadata: "{\"generation_mode\":\"manual_topic\"}",
      }),
    } as never,
    runtime: {
      findDefinitionByCode: async () => ({
        id: "def_writer",
      }),
      createTask: async () => {
        createdTask = true;
      },
    } as never,
    auditLogs: {
      append: async () => {
        appendedAudit = true;
      },
    } as never,
    queueAccountAutomationTick: {
      execute: async () => {
        queuedTick = true;
      },
    } as never,
    clock: {
      now: () => new Date("2026-04-22T05:00:00.000Z"),
    },
  });

  await assert.rejects(async () => {
    await command.execute("draft_1", {
      reviewer_type: "user",
    });
  }, (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.code, "INVALID_STATE");
    assert.match(error.message, /content_brief_id/);
    return true;
  });

  assert.equal(createdTask, false);
  assert.equal(appendedReview, false);
  assert.equal(appendedAudit, false);
  assert.equal(queuedTick, false);
});

test("RequestDraftRegeneration queues a brief-backed regeneration task without topic fallback", async () => {
  const createdTasks: Array<{ payload: string }> = [];
  let appendedReview = false;
  let queuedTick = false;

  const command = new RequestDraftRegeneration({
    drafts: {
      findById: async () => ({
        id: "draft_1",
        workspace_id: "ws_1",
        account_id: "acct_1",
        trend_id: "trend_1",
        current_version_id: "version_1",
        topic: "brief backed draft",
        created_at: "2026-04-22T04:00:00.000Z",
        updated_at: "2026-04-22T04:00:00.000Z",
      }),
      appendReview: async () => {
        appendedReview = true;
      },
    } as never,
    versions: {
      findById: async () => ({
        id: "version_1",
        metadata: "{\"content_brief_id\":\"brief_1\",\"generation_mode\":\"source_backed\"}",
      }),
    } as never,
    runtime: {
      findDefinitionByCode: async () => ({
        id: "def_writer",
      }),
      createTask: async (task: { payload: string }) => {
        createdTasks.push(task);
      },
    } as never,
    auditLogs: {
      append: async () => undefined,
    } as never,
    queueAccountAutomationTick: {
      execute: async () => {
        queuedTick = true;
      },
    } as never,
    clock: {
      now: () => new Date("2026-04-22T05:00:00.000Z"),
    },
  });

  const result = await command.execute("draft_1", {
    reviewer_type: "user",
  });

  assert.equal(result.status, "queued");
  assert.equal(createdTasks.length, 1);
  assert.equal(appendedReview, true);
  assert.equal(queuedTick, true);

  const payload = JSON.parse(createdTasks[0]!.payload) as Record<string, unknown>;
  assert.equal(payload.content_brief_id, "brief_1");
  assert.equal(payload.trend_id, "trend_1");
  assert.ok(!("topic" in payload));
});
