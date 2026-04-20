import { AppError } from "../../../core/errors/app-error";
import { requireIsoDateTimeString, requireNonEmptyString, requireOneOf } from "../../../core/validation/guards";
import type { AutopostGenerationMode } from "./autopost-policy";

export type AutopostRunStatus =
  | "queued"
  | "brief_generating"
  | "draft_generating"
  | "awaiting_review"
  | "scheduled"
  | "publish_queued"
  | "failed";

export interface AutopostRun {
  id: string;
  policy_id: string;
  workspace_id: string;
  account_id: string;
  generation_mode: AutopostGenerationMode;
  source_scope: string;
  scheduled_for: string;
  trend_id?: string;
  brief_id?: string;
  brief_task_id?: string;
  draft_id?: string;
  draft_task_id?: string;
  schedule_id?: string;
  publish_job_id?: string;
  status: AutopostRunStatus;
  error_code?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
  finished_at?: string;
}

export function createAutopostRun(input: Omit<AutopostRun, "status">): AutopostRun {
  return {
    id: requireNonEmptyString(input.id, "id"),
    policy_id: requireNonEmptyString(input.policy_id, "policy_id"),
    workspace_id: requireNonEmptyString(input.workspace_id, "workspace_id"),
    account_id: requireNonEmptyString(input.account_id, "account_id"),
    generation_mode: requireOneOf(input.generation_mode, "generation_mode", ["from_trend", "from_source_scope"] as const),
    source_scope: requireNonEmptyString(input.source_scope, "source_scope"),
    scheduled_for: requireIsoDateTimeString(input.scheduled_for, "scheduled_for"),
    trend_id: optionalString(input.trend_id),
    brief_id: optionalString(input.brief_id),
    brief_task_id: optionalString(input.brief_task_id),
    draft_id: optionalString(input.draft_id),
    draft_task_id: optionalString(input.draft_task_id),
    schedule_id: optionalString(input.schedule_id),
    publish_job_id: optionalString(input.publish_job_id),
    status: "queued",
    error_code: optionalString(input.error_code),
    error_message: optionalString(input.error_message),
    created_at: requireIsoDateTimeString(input.created_at, "created_at"),
    updated_at: requireIsoDateTimeString(input.updated_at, "updated_at"),
    finished_at: optionalIsoDateTimeString(input.finished_at, "finished_at"),
  };
}

export function markAutopostRunBriefGenerating(run: AutopostRun, input: {
  brief_id: string;
  brief_task_id: string;
  trend_id?: string;
  updated_at: string;
}): AutopostRun {
  assertStatus(run, ["queued"], "brief_generating");
  return {
    ...run,
    trend_id: optionalString(input.trend_id),
    brief_id: requireNonEmptyString(input.brief_id, "brief_id"),
    brief_task_id: requireNonEmptyString(input.brief_task_id, "brief_task_id"),
    status: "brief_generating",
    error_code: undefined,
    error_message: undefined,
    updated_at: requireIsoDateTimeString(input.updated_at, "updated_at"),
    finished_at: undefined,
  };
}

export function markAutopostRunDraftGenerating(run: AutopostRun, input: {
  draft_task_id: string;
  draft_id?: string;
  updated_at: string;
}): AutopostRun {
  assertStatus(run, ["brief_generating"], "draft_generating");
  return {
    ...run,
    draft_task_id: requireNonEmptyString(input.draft_task_id, "draft_task_id"),
    draft_id: optionalString(input.draft_id),
    status: "draft_generating",
    error_code: undefined,
    error_message: undefined,
    updated_at: requireIsoDateTimeString(input.updated_at, "updated_at"),
    finished_at: undefined,
  };
}

export function recordAutopostRunDraftReady(run: AutopostRun, input: {
  draft_id: string;
  updated_at: string;
}): AutopostRun {
  assertStatus(run, ["draft_generating"], "draft_generating");
  return {
    ...run,
    draft_id: requireNonEmptyString(input.draft_id, "draft_id"),
    error_code: undefined,
    error_message: undefined,
    updated_at: requireIsoDateTimeString(input.updated_at, "updated_at"),
    finished_at: undefined,
  };
}

export function markAutopostRunAwaitingReview(run: AutopostRun, input: {
  draft_id: string;
  updated_at: string;
}): AutopostRun {
  assertStatus(run, ["draft_generating"], "awaiting_review");
  return {
    ...run,
    draft_id: requireNonEmptyString(input.draft_id, "draft_id"),
    status: "awaiting_review",
    error_code: undefined,
    error_message: undefined,
    updated_at: requireIsoDateTimeString(input.updated_at, "updated_at"),
    finished_at: requireIsoDateTimeString(input.updated_at, "finished_at"),
  };
}

export function markAutopostRunScheduled(run: AutopostRun, input: {
  draft_id: string;
  schedule_id: string;
  updated_at: string;
}): AutopostRun {
  assertStatus(run, ["draft_generating"], "scheduled");
  return {
    ...run,
    draft_id: requireNonEmptyString(input.draft_id, "draft_id"),
    schedule_id: requireNonEmptyString(input.schedule_id, "schedule_id"),
    status: "scheduled",
    error_code: undefined,
    error_message: undefined,
    updated_at: requireIsoDateTimeString(input.updated_at, "updated_at"),
    finished_at: requireIsoDateTimeString(input.updated_at, "finished_at"),
  };
}

export function markAutopostRunPublishQueued(run: AutopostRun, input: {
  draft_id: string;
  schedule_id: string;
  publish_job_id: string;
  updated_at: string;
}): AutopostRun {
  assertStatus(run, ["draft_generating"], "publish_queued");
  return {
    ...run,
    draft_id: requireNonEmptyString(input.draft_id, "draft_id"),
    schedule_id: requireNonEmptyString(input.schedule_id, "schedule_id"),
    publish_job_id: requireNonEmptyString(input.publish_job_id, "publish_job_id"),
    status: "publish_queued",
    error_code: undefined,
    error_message: undefined,
    updated_at: requireIsoDateTimeString(input.updated_at, "updated_at"),
    finished_at: requireIsoDateTimeString(input.updated_at, "finished_at"),
  };
}

export function failAutopostRun(run: AutopostRun, input: {
  error_code: string;
  error_message: string;
  updated_at: string;
}): AutopostRun {
  if (["awaiting_review", "scheduled", "publish_queued", "failed"].includes(run.status)) {
    throw new AppError("INVALID_STATE", `autopost run cannot transition from ${run.status} to failed`, {
      details: { autopost_run_id: run.id, from: run.status, to: "failed" },
    });
  }

  return {
    ...run,
    status: "failed",
    error_code: requireNonEmptyString(input.error_code, "error_code"),
    error_message: requireNonEmptyString(input.error_message, "error_message"),
    updated_at: requireIsoDateTimeString(input.updated_at, "updated_at"),
    finished_at: requireIsoDateTimeString(input.updated_at, "finished_at"),
  };
}

function assertStatus(run: AutopostRun, allowed: AutopostRunStatus[], to: AutopostRunStatus) {
  if (!allowed.includes(run.status)) {
    throw new AppError("INVALID_STATE", `autopost run cannot transition from ${run.status} to ${to}`, {
      details: { autopost_run_id: run.id, from: run.status, to },
    });
  }
}

function optionalIsoDateTimeString(value: unknown, field: string): string | undefined {
  const normalized = optionalString(value);
  return normalized ? requireIsoDateTimeString(normalized, field) : undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}
