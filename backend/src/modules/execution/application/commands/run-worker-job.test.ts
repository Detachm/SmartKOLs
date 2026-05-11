import test from "node:test";
import assert from "node:assert/strict";
import { AppError } from "../../../../core/errors/app-error";
import { createWorkerJob, type WorkerJob } from "../../domain/worker-job";
import { RunWorkerJob } from "./run-worker-job";

test("RunWorkerJob executes scheduled autopost jobs via ExecuteAutopostPolicy", async () => {
  const savedJobs: WorkerJob[] = [];
  let currentJob = createWorkerJob({
    id: "job_1",
    workspace_id: "ws_1",
    job_type: "autopost.execute",
    target_type: "autopost_policy",
    target_id: "policy_1",
    payload: JSON.stringify({
      policy_id: "policy_1",
      account_id: "acct_1",
    }),
    run_after: "2026-04-21T03:30:00.000Z",
    created_at: "2026-04-21T03:00:00.000Z",
  });
  const autopostExecutions: Array<{ policy_id?: string; account_id?: string; trigger?: "manual" | "scheduled" }> = [];

  const command = new RunWorkerJob({
    workerJobs: {
      findById: async () => currentJob,
      save: async (job: WorkerJob) => {
        currentJob = job;
        savedJobs.push(job);
      },
    } as never,
    pullMentions: { execute: async () => undefined } as never,
    pullDirectMessages: { execute: async () => undefined } as never,
    sendReplyProposal: { execute: async () => undefined } as never,
    executeAutopostPolicy: {
      execute: async (input: { policy_id?: string; account_id?: string; trigger?: "manual" | "scheduled" }) => {
        autopostExecutions.push(input);
        return {
          policy: {} as never,
          run: { id: "run_1", status: "brief_generating" as const },
          task_id: "task_1",
        };
      },
    } as never,
    recurringBriefPlans: { findById: async () => null } as never,
    queueAccountAutomationTick: {
      execute: async () => {
        throw new Error("autopost worker job should not queue orchestration tick");
      },
    } as never,
    tickAccountAutomation: { execute: async () => undefined } as never,
    failRecurringBriefPlanExecution: { execute: async () => undefined } as never,
    failWorkerJob: { execute: async () => undefined } as never,
    clock: {
      now: () => new Date("2026-04-21T03:30:00.000Z"),
    },
  });

  const result = await command.execute("job_1");

  assert.equal(result.status, "succeeded");
  assert.deepEqual(autopostExecutions, [{
    policy_id: "policy_1",
    trigger: "scheduled",
  }]);
  assert.equal(savedJobs.length, 2);
  assert.equal(savedJobs[0]?.status, "running");
  assert.equal(savedJobs[1]?.status, "succeeded");
});

test("RunWorkerJob delays automatic retry for temporary external worker failures", async () => {
  const savedJobs: WorkerJob[] = [];
  let currentJob = createWorkerJob({
    id: "job_retry",
    workspace_id: "ws_1",
    job_type: "mentions.pull",
    target_type: "account",
    target_id: "acct_1",
    payload: JSON.stringify({ account_id: "acct_1" }),
    run_after: "2026-04-21T03:30:00.000Z",
    created_at: "2026-04-21T03:00:00.000Z",
  });
  let failedWorkerJobCalled = false;

  const command = new RunWorkerJob({
    workerJobs: {
      findById: async () => currentJob,
      save: async (job: WorkerJob) => {
        currentJob = job;
        savedJobs.push(job);
      },
    } as never,
    pullMentions: {
      execute: async () => {
        throw new AppError("EXTERNAL_DEPENDENCY_ERROR", "x api temporarily unavailable");
      },
    } as never,
    pullDirectMessages: { execute: async () => undefined } as never,
    sendReplyProposal: { execute: async () => undefined } as never,
    executeAutopostPolicy: { execute: async () => undefined } as never,
    recurringBriefPlans: { findById: async () => null } as never,
    queueAccountAutomationTick: { execute: async () => undefined } as never,
    tickAccountAutomation: { execute: async () => undefined } as never,
    failRecurringBriefPlanExecution: { execute: async () => undefined } as never,
    failWorkerJob: {
      execute: async () => {
        failedWorkerJobCalled = true;
      },
    } as never,
    clock: {
      now: () => new Date("2026-04-21T03:30:00.000Z"),
    },
  });

  const result = await command.execute("job_retry");

  assert.equal(result.status, "queued");
  assert.equal(result.run_after, "2026-04-21T03:45:00.000Z");
  assert.equal(failedWorkerJobCalled, false);
  assert.deepEqual(savedJobs.map((job) => job.status), ["running", "queued"]);
  assert.equal(JSON.parse(result.payload).__auto_retry_attempt, 1);
});
