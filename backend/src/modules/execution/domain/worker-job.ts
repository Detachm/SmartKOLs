import { AppError } from "../../../core/errors/app-error";
import { requireNonEmptyString, requireOneOf } from "../../../core/validation/guards";

export type WorkerJobType =
  | "mentions.pull"
  | "dm.pull"
  | "engagement.reply.execute"
  | "editorial.recurring_brief.execute"
  | "autopost.execute"
  | "orchestration.tick";
export type WorkerJobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export interface WorkerJob {
  id: string;
  workspace_id: string;
  job_type: WorkerJobType;
  target_type: string;
  target_id: string;
  payload: string;
  status: WorkerJobStatus;
  run_after: string;
  lease_expires_at?: string;
  error_code?: string;
  error_message?: string;
  started_at?: string;
  finished_at?: string;
  created_at: string;
}

export function createWorkerJob(input: Omit<WorkerJob, "status">): WorkerJob {
  return {
    id: requireNonEmptyString(input.id, "id"),
    workspace_id: requireNonEmptyString(input.workspace_id, "workspace_id"),
    job_type: requireOneOf(input.job_type, "job_type", [
      "mentions.pull",
      "dm.pull",
      "engagement.reply.execute",
      "editorial.recurring_brief.execute",
      "autopost.execute",
      "orchestration.tick",
    ] as const),
    target_type: requireNonEmptyString(input.target_type, "target_type"),
    target_id: requireNonEmptyString(input.target_id, "target_id"),
    payload: requireNonEmptyString(input.payload, "payload"),
    status: "queued",
    run_after: requireNonEmptyString(input.run_after, "run_after"),
    lease_expires_at: undefined,
    error_code: undefined,
    error_message: undefined,
    started_at: undefined,
    finished_at: undefined,
    created_at: requireNonEmptyString(input.created_at, "created_at"),
  };
}

export function startWorkerJob(job: WorkerJob, startedAt: string, leaseExpiresAt: string): WorkerJob {
  if (job.status !== "queued") {
    throw new AppError("INVALID_STATE", `worker job cannot transition from ${job.status} to running`, {
      details: { worker_job_id: job.id, from: job.status, to: "running" },
    });
  }

  return {
    ...job,
    status: "running",
    error_code: undefined,
    error_message: undefined,
    started_at: requireNonEmptyString(startedAt, "started_at"),
    lease_expires_at: requireNonEmptyString(leaseExpiresAt, "lease_expires_at"),
    finished_at: undefined,
  };
}

export function succeedWorkerJob(job: WorkerJob, finishedAt: string): WorkerJob {
  if (job.status !== "running") {
    throw new AppError("INVALID_STATE", `worker job cannot transition from ${job.status} to succeeded`, {
      details: { worker_job_id: job.id, from: job.status, to: "succeeded" },
    });
  }

  return {
    ...job,
    status: "succeeded",
    lease_expires_at: undefined,
    error_code: undefined,
    error_message: undefined,
    finished_at: requireNonEmptyString(finishedAt, "finished_at"),
  };
}

export function failWorkerJob(job: WorkerJob, finishedAt: string, errorCode: string, errorMessage: string): WorkerJob {
  if (!["queued", "running"].includes(job.status)) {
    throw new AppError("INVALID_STATE", `worker job cannot transition from ${job.status} to failed`, {
      details: { worker_job_id: job.id, from: job.status, to: "failed" },
    });
  }

  return {
    ...job,
    status: "failed",
    lease_expires_at: undefined,
    error_code: requireNonEmptyString(errorCode, "error_code"),
    error_message: requireNonEmptyString(errorMessage, "error_message"),
    finished_at: requireNonEmptyString(finishedAt, "finished_at"),
  };
}

export function retryWorkerJob(job: WorkerJob, runAfter: string): WorkerJob {
  if (job.status !== "failed") {
    throw new AppError("INVALID_STATE", `worker job cannot transition from ${job.status} to queued`, {
      details: { worker_job_id: job.id, from: job.status, to: "queued" },
    });
  }

  return {
    ...job,
    status: "queued",
    run_after: requireNonEmptyString(runAfter, "run_after"),
    lease_expires_at: undefined,
    error_code: undefined,
    error_message: undefined,
    started_at: undefined,
    finished_at: undefined,
  };
}
