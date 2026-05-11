import test from "node:test";
import assert from "node:assert/strict";
import { AppError } from "../../../../core/errors/app-error";
import { createPublishJob, type PublishJob } from "../../domain/publish-job";
import { ExecutePublishJob } from "./execute-publish-job";

test("ExecutePublishJob delays automatic retry for temporary publish failures", async () => {
  const savedJobs: PublishJob[] = [];
  let currentJob = createPublishJob({
    id: "publish_job_1",
    schedule_id: "schedule_1",
    idempotency_key: "publish:job:1",
    run_after: "2026-04-21T10:00:00.000Z",
  });
  let markFailedCalled = false;

  const command = new ExecutePublishJob({
    schedules: {
      findPublishJobById: async () => currentJob,
      findScheduleById: async () => ({
        id: "schedule_1",
        workspace_id: "ws_1",
        account_id: "acct_1",
        draft_id: "draft_1",
        scheduled_for: "2026-04-21T10:00:00.000Z",
        status: "queued",
        created_at: "2026-04-21T09:00:00.000Z",
        updated_at: "2026-04-21T09:00:00.000Z",
      }),
      savePublishJob: async (job: PublishJob) => {
        currentJob = job;
        savedJobs.push(job);
      },
    } as never,
    drafts: {
      findById: async () => ({
        id: "draft_1",
        workspace_id: "ws_1",
        account_id: "acct_1",
        status: "scheduled",
        current_version_id: "version_1",
      }),
    } as never,
    versions: {
      findById: async () => ({
        id: "version_1",
        draft_id: "draft_1",
        content: "hello",
      }),
    } as never,
    createPost: {
      execute: async () => {
        throw new AppError("EXTERNAL_DEPENDENCY_ERROR", "x api temporarily unavailable");
      },
    } as never,
    completePublishJob: {
      execute: async () => {
        throw new Error("publish should not complete");
      },
    } as never,
    markPublishFailed: {
      execute: async () => {
        markFailedCalled = true;
      },
    } as never,
    clock: {
      now: () => new Date("2026-04-21T10:00:00.000Z"),
    },
  });

  const result = await command.execute("publish_job_1");

  assert.equal(result.status, "queued");
  assert.equal(result.run_after, "2026-04-21T10:15:00.000Z");
  assert.equal(result.error_code, "EXTERNAL_DEPENDENCY_ERROR");
  assert.equal(markFailedCalled, false);
  assert.deepEqual(savedJobs.map((job) => job.status), ["running", "queued"]);
  assert.match(result.idempotency_key, /:auto-retry:1:/);
});
