import { AppError } from "../../../core/errors/app-error";
import { requireIntegerInRange, requireIsoDateTimeString, requireNonEmptyString, requireOneOf } from "../../../core/validation/guards";
import type { SourceType } from "../../sources/domain/source";

export type EditorialWeekdayCode = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type SourceWatchlistStatus = "active" | "paused";
export type RecurringBriefPlanStatus = "active" | "paused";
export type RecurringBriefPlanGenerationMode = "from_trend" | "from_source_scope";
export type RecurringBriefPlanLastRunStatus = "succeeded" | "failed";

export interface EditorialCadence {
  timezone: string;
  weekday_codes: EditorialWeekdayCode[];
  slot_times: string[];
  min_spacing_minutes: number;
}

export interface EditorialSourceScopePreset {
  source_ids: string[];
  source_types: SourceType[];
  preferred_source_ids: string[];
  preferred_source_types: SourceType[];
  query?: string;
  max_source_age_days: number;
  limit: number;
}

export interface SourceWatchlist {
  id: string;
  workspace_id: string;
  account_id: string;
  name: string;
  description?: string;
  scope_body: EditorialSourceScopePreset;
  status: SourceWatchlistStatus;
  created_at: string;
  updated_at: string;
}

export interface RecurringBriefPlanQueueItem {
  id: string;
  title: string;
  topic_hint: string;
  angle_hint?: string;
  audience?: string;
  status: "queued" | "consumed";
  consumed_at?: string;
}

export interface RecurringBriefPlanStrategy {
  generation_mode: RecurringBriefPlanGenerationMode;
  watchlist_id?: string;
  source_scope_body?: EditorialSourceScopePreset;
  default_topic_hint?: string;
  default_angle_hint?: string;
  default_audience?: string;
  campaign_queue: RecurringBriefPlanQueueItem[];
}

export interface RecurringBriefPlan {
  id: string;
  workspace_id: string;
  account_id: string;
  name: string;
  description?: string;
  cadence_body: EditorialCadence;
  strategy_body: RecurringBriefPlanStrategy;
  status: RecurringBriefPlanStatus;
  next_run_after?: string;
  last_attempted_at?: string;
  last_run_status?: RecurringBriefPlanLastRunStatus;
  last_failed_at?: string;
  last_error_code?: string;
  last_error_message?: string;
  last_enqueued_at?: string;
  last_brief_id?: string;
  created_at: string;
  updated_at: string;
}

const WEEKDAY_ORDER: EditorialWeekdayCode[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const SOURCE_TYPE_ORDER: SourceType[] = ["rss", "website", "twitter", "youtube", "substack", "telegram"];

export function createEditorialCadence(input: EditorialCadence): EditorialCadence {
  return {
    timezone: requireTimeZone(input.timezone),
    weekday_codes: normalizeWeekdayCodes(input.weekday_codes),
    slot_times: normalizeSlotTimes(input.slot_times),
    min_spacing_minutes: requireIntegerInRange(input.min_spacing_minutes, "cadence_body.min_spacing_minutes", 15, 1440),
  };
}

export function createEditorialSourceScopePreset(input: EditorialSourceScopePreset): EditorialSourceScopePreset {
  const normalized = {
    source_ids: normalizeStringArray(input.source_ids),
    source_types: normalizeSourceTypes(input.source_types, "scope_body.source_types"),
    preferred_source_ids: normalizeStringArray(input.preferred_source_ids),
    preferred_source_types: normalizeSourceTypes(input.preferred_source_types, "scope_body.preferred_source_types"),
    query: optionalString(input.query),
    max_source_age_days: requireIntegerInRange(input.max_source_age_days, "scope_body.max_source_age_days", 1, 365),
    limit: requireIntegerInRange(input.limit, "scope_body.limit", 1, 120),
  };

  if (
    normalized.source_ids.length === 0
    && normalized.source_types.length === 0
    && !normalized.query
    && normalized.preferred_source_ids.length === 0
    && normalized.preferred_source_types.length === 0
  ) {
    throw new AppError("VALIDATION_ERROR", "scope_body must define at least one source selector or preference");
  }

  return normalized;
}

export function createSourceWatchlist(input: SourceWatchlist): SourceWatchlist {
  return {
    id: requireNonEmptyString(input.id, "id"),
    workspace_id: requireNonEmptyString(input.workspace_id, "workspace_id"),
    account_id: requireNonEmptyString(input.account_id, "account_id"),
    name: requireNonEmptyString(input.name, "name"),
    description: optionalString(input.description),
    scope_body: createEditorialSourceScopePreset(input.scope_body),
    status: requireOneOf(input.status, "status", ["active", "paused"] as const),
    created_at: requireIsoDateTimeString(input.created_at, "created_at"),
    updated_at: requireIsoDateTimeString(input.updated_at, "updated_at"),
  };
}

export function createRecurringBriefPlan(input: RecurringBriefPlan): RecurringBriefPlan {
  const strategy = createRecurringBriefPlanStrategy(input.strategy_body);
  if (strategy.generation_mode === "from_trend" && (strategy.watchlist_id || strategy.source_scope_body)) {
    throw new AppError("VALIDATION_ERROR", "from_trend recurring plans cannot define watchlist_id or source_scope_body");
  }

  if (strategy.generation_mode === "from_source_scope" && !strategy.watchlist_id && !strategy.source_scope_body) {
    throw new AppError("VALIDATION_ERROR", "from_source_scope recurring plans require exactly one of watchlist_id or source_scope_body");
  }

  if (strategy.generation_mode === "from_source_scope" && strategy.watchlist_id && strategy.source_scope_body) {
    throw new AppError("VALIDATION_ERROR", "from_source_scope recurring plans cannot define both watchlist_id and source_scope_body");
  }

  return {
    id: requireNonEmptyString(input.id, "id"),
    workspace_id: requireNonEmptyString(input.workspace_id, "workspace_id"),
    account_id: requireNonEmptyString(input.account_id, "account_id"),
    name: requireNonEmptyString(input.name, "name"),
    description: optionalString(input.description),
    cadence_body: createEditorialCadence(input.cadence_body),
    strategy_body: strategy,
    status: requireOneOf(input.status, "status", ["active", "paused"] as const),
    next_run_after: optionalIsoDateTimeString(input.next_run_after, "next_run_after"),
    last_attempted_at: optionalIsoDateTimeString(input.last_attempted_at, "last_attempted_at"),
    last_run_status: input.last_run_status === undefined
      ? undefined
      : requireOneOf(input.last_run_status, "last_run_status", ["succeeded", "failed"] as const),
    last_failed_at: optionalIsoDateTimeString(input.last_failed_at, "last_failed_at"),
    last_error_code: optionalString(input.last_error_code),
    last_error_message: optionalString(input.last_error_message),
    last_enqueued_at: optionalIsoDateTimeString(input.last_enqueued_at, "last_enqueued_at"),
    last_brief_id: optionalString(input.last_brief_id),
    created_at: requireIsoDateTimeString(input.created_at, "created_at"),
    updated_at: requireIsoDateTimeString(input.updated_at, "updated_at"),
  };
}

export function consumeRecurringPlanQueueItem(
  plan: RecurringBriefPlan,
  queueItemId: string,
  consumedAt: string,
): { plan: RecurringBriefPlan; item: RecurringBriefPlanQueueItem } {
  const target = plan.strategy_body.campaign_queue.find((item) => item.id === queueItemId);
  if (!target || target.status !== "queued") {
    throw new AppError("INVALID_STATE", "recurring brief queue item is not available", {
      details: { plan_id: plan.id, queue_item_id: queueItemId },
    });
  }

  const nextQueue = plan.strategy_body.campaign_queue.map((item) => item.id === queueItemId
    ? { ...item, status: "consumed" as const, consumed_at: requireIsoDateTimeString(consumedAt, "consumed_at") }
    : item);
  const consumed = nextQueue.find((item) => item.id === queueItemId)!;

  return {
    item: consumed,
    plan: createRecurringBriefPlan({
      ...plan,
      strategy_body: {
        ...plan.strategy_body,
        campaign_queue: nextQueue,
      },
      updated_at: consumedAt,
    }),
  };
}

function createRecurringBriefPlanStrategy(input: RecurringBriefPlanStrategy): RecurringBriefPlanStrategy {
  const campaignQueue = input.campaign_queue.map((item) => ({
    id: requireNonEmptyString(item.id, "campaign_queue.id"),
    title: requireNonEmptyString(item.title, "campaign_queue.title"),
    topic_hint: requireNonEmptyString(item.topic_hint, "campaign_queue.topic_hint"),
    angle_hint: optionalString(item.angle_hint),
    audience: optionalString(item.audience),
    status: requireOneOf(item.status, "campaign_queue.status", ["queued", "consumed"] as const),
    consumed_at: optionalIsoDateTimeString(item.consumed_at, "campaign_queue.consumed_at"),
  }));

  return {
    generation_mode: requireOneOf(input.generation_mode, "strategy_body.generation_mode", ["from_trend", "from_source_scope"] as const),
    watchlist_id: optionalString(input.watchlist_id),
    source_scope_body: input.source_scope_body ? createEditorialSourceScopePreset(input.source_scope_body) : undefined,
    default_topic_hint: optionalString(input.default_topic_hint),
    default_angle_hint: optionalString(input.default_angle_hint),
    default_audience: optionalString(input.default_audience),
    campaign_queue: campaignQueue,
  };
}

function normalizeWeekdayCodes(value: EditorialWeekdayCode[]): EditorialWeekdayCode[] {
  const unique = new Set<EditorialWeekdayCode>();
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

function normalizeSourceTypes(value: SourceType[], field: string): SourceType[] {
  return Array.from(new Set(value.map((item) => requireOneOf(item, field, SOURCE_TYPE_ORDER))));
}

function normalizeStringArray(values: string[]): string[] {
  return Array.from(new Set(values.map((item) => item.trim()).filter((item) => item !== "")));
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function optionalIsoDateTimeString(value: unknown, field: string): string | undefined {
  const normalized = optionalString(value);
  return normalized ? requireIsoDateTimeString(normalized, field) : undefined;
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
