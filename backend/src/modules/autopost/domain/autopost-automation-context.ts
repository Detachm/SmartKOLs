import { AppError } from "../../../core/errors/app-error";
import { requireNonEmptyString } from "../../../core/validation/guards";

export interface AutopostAutomationContext {
  kind: "autopost";
  policy_id: string;
  run_id: string;
}

export function createAutopostAutomationContext(input: AutopostAutomationContext): AutopostAutomationContext {
  return {
    kind: "autopost",
    policy_id: requireNonEmptyString(input.policy_id, "policy_id"),
    run_id: requireNonEmptyString(input.run_id, "run_id"),
  };
}

export function parseAutopostAutomationContext(value: unknown): AutopostAutomationContext | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const raw = value as {
    kind?: unknown;
    policy_id?: unknown;
    run_id?: unknown;
  };

  if (raw.kind !== "autopost") {
    return undefined;
  }

  try {
    return createAutopostAutomationContext({
      kind: "autopost",
      policy_id: typeof raw.policy_id === "string" ? raw.policy_id : "",
      run_id: typeof raw.run_id === "string" ? raw.run_id : "",
    });
  } catch (error) {
    throw new AppError("INVALID_STATE", "autopost automation context is invalid", {
      cause: error,
      details: { automation: value },
    });
  }
}
