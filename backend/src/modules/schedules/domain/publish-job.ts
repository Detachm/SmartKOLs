import { AppError } from "../../../core/errors/app-error";
import { requireNonEmptyString } from "../../../core/validation/guards";

export type PublishJobStatus = "queued" | "running" | "succeeded" | "failed";

export interface PublishJob {
  id: string;
  schedule_id: string;
  status: PublishJobStatus;
  idempotency_key: string;
  error_code?: string;
  error_message?: string;
  run_after: string;
  started_at?: string;
  lease_expires_at?: string;
  finished_at?: string;
}

export function createPublishJob(input: {
  id: string;
  schedule_id: string;
  idempotency_key: string;
  run_after: string;
}): PublishJob {
  return {
    id: requireNonEmptyString(input.id, "id"),
    schedule_id: requireNonEmptyString(input.schedule_id, "schedule_id"),
    status: "queued",
    idempotency_key: requireNonEmptyString(input.idempotency_key, "idempotency_key"),
    run_after: requireNonEmptyString(input.run_after, "run_after"),
    error_code: undefined,
    error_message: undefined,
    started_at: undefined,
    lease_expires_at: undefined,
    finished_at: undefined,
  };
}

export function markPublishJobSucceeded(job: PublishJob, finishedAt: string): PublishJob {
  if (!["queued", "running"].includes(job.status)) {
    throw new AppError("INVALID_STATE", `publish job cannot transition from ${job.status} to succeeded`, {
      details: { publish_job_id: job.id, from: job.status, to: "succeeded" },
    });
  }

  return {
    ...job,
    status: "succeeded",
    lease_expires_at: undefined,
    finished_at: requireNonEmptyString(finishedAt, "finished_at"),
    error_code: undefined,
    error_message: undefined,
  };
}

export function markPublishJobRunning(job: PublishJob, startedAt: string, leaseExpiresAt: string): PublishJob {
  if (job.status !== "queued") {
    throw new AppError("INVALID_STATE", `publish job cannot transition from ${job.status} to running`, {
      details: { publish_job_id: job.id, from: job.status, to: "running" },
    });
  }

  return {
    ...job,
    status: "running",
    started_at: requireNonEmptyString(startedAt, "started_at"),
    lease_expires_at: requireNonEmptyString(leaseExpiresAt, "lease_expires_at"),
    finished_at: undefined,
    error_code: undefined,
    error_message: undefined,
  };
}

export function markPublishJobFailed(job: PublishJob, finishedAt: string, errorCode: string, errorMessage: string): PublishJob {
  if (!["queued", "running"].includes(job.status)) {
    throw new AppError("INVALID_STATE", `publish job cannot transition from ${job.status} to failed`, {
      details: { publish_job_id: job.id, from: job.status, to: "failed" },
    });
  }

  return {
    ...job,
    status: "failed",
    error_code: requireNonEmptyString(errorCode, "error_code"),
    error_message: requireNonEmptyString(errorMessage, "error_message"),
    lease_expires_at: undefined,
    finished_at: requireNonEmptyString(finishedAt, "finished_at"),
  };
}
