import test from "node:test";
import assert from "node:assert/strict";
import { AppError } from "../../../../core/errors/app-error";
import { GenerateDraft } from "./generate-draft";

test("GenerateDraft rejects topic-only requests and requires a content brief", async () => {
  let createdTask = false;
  let queuedTick = false;

  const command = new GenerateDraft({
    runtime: {
      findDefinitionByCode: async () => ({
        id: "def_writer",
      }),
      createTask: async () => {
        createdTask = true;
      },
    } as never,
    accounts: {
      findById: async () => ({
        id: "acct_1",
        workspace_id: "ws_1",
      }),
    } as never,
    queueAccountAutomationTick: {
      execute: async () => {
        queuedTick = true;
      },
    } as never,
    now: () => "2026-04-22T05:00:00.000Z",
  });

  await assert.rejects(async () => {
    await command.execute({
      account_id: "acct_1",
      topic: "legacy topic only draft",
      trend_id: "trend_1",
    });
  }, (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.code, "VALIDATION_ERROR");
    assert.match(error.message, /content_brief_id/);
    return true;
  });

  assert.equal(createdTask, false);
  assert.equal(queuedTick, false);
});

test("GenerateDraft queues a writer task with content_brief_id and drops raw topic payload", async () => {
  const createdTasks: Array<{ payload: string; task_type: string }> = [];
  let queuedTick = false;

  const command = new GenerateDraft({
    runtime: {
      findDefinitionByCode: async () => ({
        id: "def_writer",
      }),
      createTask: async (task: { payload: string; task_type: string }) => {
        createdTasks.push(task);
      },
    } as never,
    accounts: {
      findById: async () => ({
        id: "acct_1",
        workspace_id: "ws_1",
      }),
    } as never,
    queueAccountAutomationTick: {
      execute: async () => {
        queuedTick = true;
      },
    } as never,
    now: () => "2026-04-22T05:00:00.000Z",
  });

  const result = await command.execute({
    account_id: "acct_1",
    topic: "should be ignored once brief exists",
    trend_id: "trend_1",
    content_brief_id: "brief_1",
  });

  assert.equal(result.status, "queued");
  assert.equal(createdTasks.length, 1);
  assert.equal(createdTasks[0]?.task_type, "draft.generate");

  const payload = JSON.parse(createdTasks[0]!.payload) as Record<string, unknown>;
  assert.equal(payload.content_brief_id, "brief_1");
  assert.equal(payload.trend_id, "trend_1");
  assert.ok(!("topic" in payload));
  assert.equal(queuedTick, true);
});
