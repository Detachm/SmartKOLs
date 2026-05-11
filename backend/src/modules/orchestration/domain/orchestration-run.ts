import { requireIsoDateTimeString, requireNonEmptyString, requireOneOf } from "../../../core/validation/guards";

export type OrchestrationRunTriggerKind = "manual" | "content_task_follow_up" | "draft_review_follow_up" | "system";
export type OrchestrationRunStatus = "running" | "succeeded" | "failed";

export interface OrchestrationRun {
  id: string;
  workspace_id: string;
  account_id: string;
  trigger_kind: OrchestrationRunTriggerKind;
  eligible_actions_json: string;
  chosen_action_json?: string;
  status: OrchestrationRunStatus;
  error_code?: string;
  error_message?: string;
  created_at: string;
  finished_at?: string;
}

export function createOrchestrationRun(input: Omit<OrchestrationRun, "status">): OrchestrationRun {
  return {
    id: requireNonEmptyString(input.id, "id"),
    workspace_id: requireNonEmptyString(input.workspace_id, "workspace_id"),
    account_id: requireNonEmptyString(input.account_id, "account_id"),
    trigger_kind: requireOneOf(input.trigger_kind, "trigger_kind", [
      "manual",
      "content_task_follow_up",
      "draft_review_follow_up",
      "system",
    ] as const),
    eligible_actions_json: requireNonEmptyString(input.eligible_actions_json, "eligible_actions_json"),
    chosen_action_json: optionalString(input.chosen_action_json),
    status: "running",
    error_code: undefined,
    error_message: undefined,
    created_at: requireIsoDateTimeString(input.created_at, "created_at"),
    finished_at: optionalIsoDateTimeString(input.finished_at, "finished_at"),
  };
}

export function succeedOrchestrationRun(
  run: OrchestrationRun,
  input: {
    eligible_actions_json: string;
    chosen_action_json: string;
    finished_at: string;
  },
): OrchestrationRun {
  return {
    ...run,
    eligible_actions_json: requireNonEmptyString(input.eligible_actions_json, "eligible_actions_json"),
    chosen_action_json: requireNonEmptyString(input.chosen_action_json, "chosen_action_json"),
    status: "succeeded",
    error_code: undefined,
    error_message: undefined,
    finished_at: requireIsoDateTimeString(input.finished_at, "finished_at"),
  };
}

export function failOrchestrationRun(
  run: OrchestrationRun,
  input: {
    error_code: string;
    error_message: string;
    eligible_actions_json?: string;
    chosen_action_json?: string;
    finished_at: string;
  },
): OrchestrationRun {
  return {
    ...run,
    eligible_actions_json: input.eligible_actions_json
      ? requireNonEmptyString(input.eligible_actions_json, "eligible_actions_json")
      : run.eligible_actions_json,
    chosen_action_json: input.chosen_action_json
      ? requireNonEmptyString(input.chosen_action_json, "chosen_action_json")
      : run.chosen_action_json,
    status: "failed",
    error_code: requireNonEmptyString(input.error_code, "error_code"),
    error_message: requireNonEmptyString(input.error_message, "error_message"),
    finished_at: requireIsoDateTimeString(input.finished_at, "finished_at"),
  };
}

function optionalIsoDateTimeString(value: unknown, field: string): string | undefined {
  const normalized = optionalString(value);
  return normalized ? requireIsoDateTimeString(normalized, field) : undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}
