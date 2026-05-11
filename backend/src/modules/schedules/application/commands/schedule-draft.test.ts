import test from "node:test";
import assert from "node:assert/strict";
import { AppError } from "../../../../core/errors/app-error";
import { ScheduleDraft } from "./schedule-draft";

test("ScheduleDraft rejects approved drafts whose current version exceeds the X post limit", async () => {
  let createScheduleCalls = 0;
  let saveDraftCalls = 0;

  const command = new ScheduleDraft({
    drafts: {
      findById: async () => ({
        id: "draft_1",
        workspace_id: "ws_1",
        account_id: "acct_1",
        status: "approved",
        current_version_id: "version_1",
        created_at: "2026-04-22T09:00:00.000Z",
        updated_at: "2026-04-22T09:00:00.000Z",
      }),
      save: async () => {
        saveDraftCalls += 1;
      },
    } as never,
    versions: {
      findById: async () => ({
        id: "version_1",
        draft_id: "draft_1",
        version_no: 1,
        content: "A".repeat(281),
        metadata: "{}",
        created_by_type: "agent",
        created_at: "2026-04-22T09:00:00.000Z",
      }),
    } as never,
    schedules: {
      createSchedule: async () => {
        createScheduleCalls += 1;
      },
    } as never,
    auditLogs: {
      append: async () => undefined,
    } as never,
    clock: {
      now: () => new Date("2026-04-22T09:05:00.000Z"),
    },
  });

  await assert.rejects(
    async () => command.execute("draft_1", { scheduled_for: "2026-04-22T10:00:00.000Z" }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.code, "VALIDATION_ERROR");
      assert.match(error.message, /cannot be scheduled/);
      assert.equal(error.details?.draft_id, "draft_1");
      assert.equal(error.details?.version_id, "version_1");
      assert.equal(error.details?.weighted_length, 281);
      return true;
    },
  );

  assert.equal(createScheduleCalls, 0);
  assert.equal(saveDraftCalls, 0);
});
