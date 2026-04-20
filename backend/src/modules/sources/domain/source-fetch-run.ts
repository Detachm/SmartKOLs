import { AppError } from "../../../core/errors/app-error";
import { requireNonEmptyString, requireOneOf } from "../../../core/validation/guards";

export type SourceFetchRunStatus = "queued" | "running" | "succeeded" | "failed";

export interface SourceFetchRun {
  id: string;
  source_id: string;
  status: SourceFetchRunStatus;
  fetched_count: number;
  error_code?: string;
  error_message?: string;
  started_at: string;
  lease_expires_at?: string;
  finished_at?: string;
}

export function createSourceFetchRun(run: SourceFetchRun): SourceFetchRun {
  return {
    id: requireNonEmptyString(run.id, "id"),
    source_id: requireNonEmptyString(run.source_id, "source_id"),
    status: requireOneOf(run.status, "status", ["queued", "running", "succeeded", "failed"] as const),
    fetched_count: run.fetched_count,
    error_code: run.error_code?.trim() || undefined,
    error_message: run.error_message?.trim() || undefined,
    started_at: requireNonEmptyString(run.started_at, "started_at"),
    lease_expires_at: run.lease_expires_at?.trim() || undefined,
    finished_at: run.finished_at?.trim() || undefined,
  };
}

export function markSourceFetchRunRunning(run: SourceFetchRun, startedAt: string, leaseExpiresAt: string): SourceFetchRun {
  if (run.status !== "queued") {
    throw new AppError("INVALID_STATE", `source fetch run cannot transition from ${run.status} to running`, {
      details: { source_fetch_run_id: run.id, from: run.status, to: "running" },
    });
  }

  return createSourceFetchRun({
    ...run,
    status: "running",
    started_at: requireNonEmptyString(startedAt, "started_at"),
    lease_expires_at: requireNonEmptyString(leaseExpiresAt, "lease_expires_at"),
    finished_at: undefined,
    error_code: undefined,
    error_message: undefined,
  });
}

export function markSourceFetchRunSucceeded(run: SourceFetchRun, fetchedCount: number, finishedAt: string): SourceFetchRun {
  if (run.status !== "running") {
    throw new AppError("INVALID_STATE", `source fetch run cannot transition from ${run.status} to succeeded`, {
      details: { source_fetch_run_id: run.id, from: run.status, to: "succeeded" },
    });
  }

  return createSourceFetchRun({
    ...run,
    status: "succeeded",
    fetched_count: fetchedCount,
    lease_expires_at: undefined,
    finished_at: requireNonEmptyString(finishedAt, "finished_at"),
    error_code: undefined,
    error_message: undefined,
  });
}

export function markSourceFetchRunFailed(
  run: SourceFetchRun,
  finishedAt: string,
  errorCode: string,
  errorMessage: string,
): SourceFetchRun {
  if (!["queued", "running"].includes(run.status)) {
    throw new AppError("INVALID_STATE", `source fetch run cannot transition from ${run.status} to failed`, {
      details: { source_fetch_run_id: run.id, from: run.status, to: "failed" },
    });
  }

  return createSourceFetchRun({
    ...run,
    status: "failed",
    lease_expires_at: undefined,
    finished_at: requireNonEmptyString(finishedAt, "finished_at"),
    error_code: requireNonEmptyString(errorCode, "error_code"),
    error_message: requireNonEmptyString(errorMessage, "error_message"),
  });
}
