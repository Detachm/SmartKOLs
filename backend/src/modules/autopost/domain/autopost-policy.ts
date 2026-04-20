import { AppError } from "../../../core/errors/app-error";
import {
  requireIntegerInRange,
  requireIsoDateTimeString,
  requireNonEmptyString,
  requireOneOf,
} from "../../../core/validation/guards";
import type { SourceType } from "../../sources/domain/source";

export type AutopostPolicyStatus = "active" | "paused";
export type AutopostPolicyLastRunStatus = "succeeded" | "failed";
export type AutopostWeekdayCode = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type AutopostGenerationMode = "from_trend" | "from_source_scope";
export type AutopostDraftReviewMode = "manual" | "auto_approve";

export interface AutopostCadence {
  timezone: string;
  weekday_codes: AutopostWeekdayCode[];
  slot_times: string[];
  min_spacing_minutes: number;
}

export interface AutopostContentStrategy {
  generation_mode: AutopostGenerationMode;
  source_types: SourceType[];
  max_source_age_days: number;
}

export interface AutopostExecution {
  draft_review_mode: AutopostDraftReviewMode;
  auto_queue_publish: boolean;
}

export interface AutopostPolicy {
  id: string;
  workspace_id: string;
  account_id: string;
  cadence_body: AutopostCadence;
  content_strategy_body: AutopostContentStrategy;
  execution_body: AutopostExecution;
  status: AutopostPolicyStatus;
  next_run_after?: string;
  last_attempted_at?: string;
  last_run_status?: AutopostPolicyLastRunStatus;
  last_failed_at?: string;
  last_error_code?: string;
  last_error_message?: string;
  last_enqueued_at?: string;
  last_run_id?: string;
  updated_at: string;
}

const WEEKDAY_ORDER: AutopostWeekdayCode[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const SOURCE_TYPE_ORDER: SourceType[] = ["rss", "website", "twitter", "youtube", "substack", "telegram"];

export function createAutopostPolicy(policy: AutopostPolicy): AutopostPolicy {
  if (policy.execution_body.draft_review_mode !== "auto_approve" && policy.execution_body.auto_queue_publish) {
    throw new AppError("VALIDATION_ERROR", "execution_body.auto_queue_publish requires draft_review_mode=auto_approve");
  }

  return {
    id: requireNonEmptyString(policy.id, "id"),
    workspace_id: requireNonEmptyString(policy.workspace_id, "workspace_id"),
    account_id: requireNonEmptyString(policy.account_id, "account_id"),
    cadence_body: {
      timezone: requireTimeZone(policy.cadence_body.timezone),
      weekday_codes: normalizeWeekdayCodes(policy.cadence_body.weekday_codes),
      slot_times: normalizeSlotTimes(policy.cadence_body.slot_times),
      min_spacing_minutes: requireIntegerInRange(
        policy.cadence_body.min_spacing_minutes,
        "cadence_body.min_spacing_minutes",
        15,
        1440,
      ),
    },
    content_strategy_body: {
      generation_mode: requireOneOf(
        policy.content_strategy_body.generation_mode,
        "content_strategy_body.generation_mode",
        ["from_trend", "from_source_scope"] as const,
      ),
      source_types: normalizeSourceTypes(policy.content_strategy_body.source_types),
      max_source_age_days: requireIntegerInRange(
        policy.content_strategy_body.max_source_age_days,
        "content_strategy_body.max_source_age_days",
        1,
        365,
      ),
    },
    execution_body: {
      draft_review_mode: requireOneOf(
        policy.execution_body.draft_review_mode,
        "execution_body.draft_review_mode",
        ["manual", "auto_approve"] as const,
      ),
      auto_queue_publish: requireBoolean(policy.execution_body.auto_queue_publish, "execution_body.auto_queue_publish"),
    },
    status: requireOneOf(policy.status, "status", ["active", "paused"] as const),
    next_run_after: optionalIsoDateTimeString(policy.next_run_after, "next_run_after"),
    last_attempted_at: optionalIsoDateTimeString(policy.last_attempted_at, "last_attempted_at"),
    last_run_status: policy.last_run_status === undefined
      ? undefined
      : requireOneOf(policy.last_run_status, "last_run_status", ["succeeded", "failed"] as const),
    last_failed_at: optionalIsoDateTimeString(policy.last_failed_at, "last_failed_at"),
    last_error_code: optionalString(policy.last_error_code),
    last_error_message: optionalString(policy.last_error_message),
    last_enqueued_at: optionalIsoDateTimeString(policy.last_enqueued_at, "last_enqueued_at"),
    last_run_id: optionalString(policy.last_run_id),
    updated_at: requireIsoDateTimeString(policy.updated_at, "updated_at"),
  };
}

function optionalIsoDateTimeString(value: unknown, field: string): string | undefined {
  const normalized = optionalString(value);
  return normalized ? requireIsoDateTimeString(normalized, field) : undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function normalizeWeekdayCodes(value: AutopostWeekdayCode[]): AutopostWeekdayCode[] {
  const unique = new Set<AutopostWeekdayCode>();
  for (const item of value) {
    unique.add(requireOneOf(item, "cadence_body.weekday_codes", WEEKDAY_ORDER));
  }

  if (unique.size === 0) {
    throw new AppError("VALIDATION_ERROR", "cadence_body.weekday_codes must contain at least one weekday");
  }

  return WEEKDAY_ORDER.filter((item) => unique.has(item));
}

function normalizeSlotTimes(value: string[]): string[] {
  const unique = new Set<string>();
  for (const item of value) {
    const normalized = requireNonEmptyString(item, "cadence_body.slot_times");
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(normalized)) {
      throw new AppError("VALIDATION_ERROR", "cadence_body.slot_times must use HH:MM 24-hour format", {
        details: { value: normalized },
      });
    }
    unique.add(normalized);
  }

  if (unique.size === 0) {
    throw new AppError("VALIDATION_ERROR", "cadence_body.slot_times must contain at least one time slot");
  }

  return Array.from(unique).sort((left, right) => left.localeCompare(right));
}

function normalizeSourceTypes(value: SourceType[]): SourceType[] {
  const unique = new Set<SourceType>();
  for (const item of value) {
    unique.add(requireOneOf(item, "content_strategy_body.source_types", SOURCE_TYPE_ORDER));
  }

  if (unique.size === 0) {
    throw new AppError("VALIDATION_ERROR", "content_strategy_body.source_types must contain at least one source type");
  }

  return SOURCE_TYPE_ORDER.filter((item) => unique.has(item));
}

function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new AppError("VALIDATION_ERROR", `${field} must be a boolean`, {
      details: { field },
    });
  }

  return value;
}

function requireTimeZone(value: unknown): string {
  const normalized = requireNonEmptyString(value, "cadence_body.timezone");
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: normalized }).format(0);
  } catch (error) {
    throw new AppError("VALIDATION_ERROR", "cadence_body.timezone must be a valid IANA timezone", {
      cause: error,
      details: { field: "cadence_body.timezone", value: normalized },
    });
  }

  return normalized;
}
