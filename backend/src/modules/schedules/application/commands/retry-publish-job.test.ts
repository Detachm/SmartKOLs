import test from "node:test";
import assert from "node:assert/strict";
import { AppError } from "../../../../core/errors/app-error";
import { createPublishJob } from "../../domain/publish-job";
import { RetryPublishJob } from "./retry-publish-job";

test("RetryPublishJob rejects failed publish jobs whose current draft version exceeds the X post limit", async () => {
  let saveScheduleCalls = 0;
  let createPublishJobCalls = 0;
  let saveDraftCalls = 0;

  const previousJob = {
    ...createPublishJob({
      id: "publish_job_1",
      schedule_id: "schedule_1",
      idempotency_key: "publish:job:1",
      run_after: "2026-04-22T10:00:00.000Z",
    }),
    status: "failed" as const,
    error_code: "VALIDATION_ERROR",
    error_message: "post exceeds X weighted length limit and cannot be published",
    finished_at: "2026-04-22T10:01:00.000Z",
  };

  const command = new RetryPublishJob({
    schedules: {
      findPublishJobById: async () => previousJob,
      findScheduleById: async () => ({
        id: "schedule_1",
        workspace_id: "ws_1",
        account_id: "acct_1",
        draft_id: "draft_1",
        scheduled_for: "2026-04-22T10:00:00.000Z",
        status: "failed",
        created_at: "2026-04-22T09:00:00.000Z",
      }),
      saveSchedule: async () => {
        saveScheduleCalls += 1;
      },
      createPublishJob: async () => {
        createPublishJobCalls += 1;
      },
    } as never,
    drafts: {
      findById: async () => ({
        id: "draft_1",
        workspace_id: "ws_1",
        account_id: "acct_1",
        status: "failed",
        current_version_id: "version_1",
        topic: "Oversized draft",
        created_at: "2026-04-22T09:00:00.000Z",
        updated_at: "2026-04-22T10:01:00.000Z",
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
    auditLogs: {
      append: async () => undefined,
    } as never,
    clock: {
      now: () => new Date("2026-04-22T10:05:00.000Z"),
    },
  });

  await assert.rejects(
    async () => command.execute("publish_job_1"),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.code, "VALIDATION_ERROR");
      assert.match(error.message, /cannot be retried for publish/);
      assert.equal(error.details?.draft_id, "draft_1");
      assert.equal(error.details?.version_id, "version_1");
      assert.equal(error.details?.publish_job_id, "publish_job_1");
      assert.equal(error.details?.weighted_length, 281);
      return true;
    },
  );

  assert.equal(saveScheduleCalls, 0);
  assert.equal(createPublishJobCalls, 0);
  assert.equal(saveDraftCalls, 0);
});
