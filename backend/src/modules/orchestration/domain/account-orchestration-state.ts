import { requireIsoDateTimeString, requireNonEmptyString, requireOneOf } from "../../../core/validation/guards";

export type AccountOrchestrationStatus = "active" | "paused";

export interface AccountOrchestrationState {
  account_id: string;
  workspace_id: string;
  status: AccountOrchestrationStatus;
  next_tick_after?: string;
  last_tick_at?: string;
  active_run_id?: string;
  last_decision_type?: string;
  last_reason_code?: string;
  created_at: string;
  updated_at: string;
}

export function createAccountOrchestrationState(input: AccountOrchestrationState): AccountOrchestrationState {
  return {
    account_id: requireNonEmptyString(input.account_id, "account_id"),
    workspace_id: requireNonEmptyString(input.workspace_id, "workspace_id"),
    status: requireOneOf(input.status, "status", ["active", "paused"] as const),
    next_tick_after: optionalIsoDateTimeString(input.next_tick_after, "next_tick_after"),
    last_tick_at: optionalIsoDateTimeString(input.last_tick_at, "last_tick_at"),
    active_run_id: optionalString(input.active_run_id),
    last_decision_type: optionalString(input.last_decision_type),
    last_reason_code: optionalString(input.last_reason_code),
    created_at: requireIsoDateTimeString(input.created_at, "created_at"),
    updated_at: requireIsoDateTimeString(input.updated_at, "updated_at"),
  };
}

export function markAccountOrchestrationTickStarted(
  state: AccountOrchestrationState,
  input: {
    run_id: string;
    updated_at: string;
  },
): AccountOrchestrationState {
  return createAccountOrchestrationState({
    ...state,
    status: "active",
    next_tick_after: undefined,
    active_run_id: input.run_id,
    updated_at: input.updated_at,
  });
}

export function completeAccountOrchestrationTick(
  state: AccountOrchestrationState,
  input: {
    last_tick_at: string;
    last_decision_type: string;
    last_reason_code?: string;
    next_tick_after?: string;
    updated_at: string;
  },
): AccountOrchestrationState {
  return createAccountOrchestrationState({
    ...state,
    next_tick_after: input.next_tick_after,
    last_tick_at: input.last_tick_at,
    active_run_id: undefined,
    last_decision_type: input.last_decision_type,
    last_reason_code: input.last_reason_code,
    updated_at: input.updated_at,
  });
}

export function pauseAccountOrchestration(
  state: AccountOrchestrationState,
  input: {
    updated_at: string;
  },
): AccountOrchestrationState {
  return createAccountOrchestrationState({
    ...state,
    status: "paused",
    next_tick_after: undefined,
    active_run_id: undefined,
    updated_at: input.updated_at,
  });
}

export function resumeAccountOrchestration(
  state: AccountOrchestrationState,
  input: {
    updated_at: string;
  },
): AccountOrchestrationState {
  return createAccountOrchestrationState({
    ...state,
    status: "active",
    updated_at: input.updated_at,
  });
}

function optionalIsoDateTimeString(value: unknown, field: string): string | undefined {
  const normalized = optionalString(value);
  return normalized ? requireIsoDateTimeString(normalized, field) : undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}
