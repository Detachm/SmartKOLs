import { AppError } from "../../../core/errors/app-error";
import { requireNonEmptyString, requireOneOf } from "../../../core/validation/guards";

export type AgentRunStatus = "running" | "succeeded" | "failed";

export interface AgentRun {
  id: string;
  task_id: string;
  request_id?: string;
  run_no: number;
  model_name: string;
  status: AgentRunStatus;
  output?: string;
  error_code?: string;
  error_message?: string;
  started_at: string;
  finished_at?: string;
}

export function createAgentRun(input: {
  id: string;
  task_id: string;
  request_id?: string;
  run_no: number;
  model_name: string;
  started_at: string;
}): AgentRun {
  return {
    id: requireNonEmptyString(input.id, "id"),
    task_id: requireNonEmptyString(input.task_id, "task_id"),
    request_id: input.request_id?.trim() || undefined,
    run_no: input.run_no,
    model_name: requireNonEmptyString(input.model_name, "model_name"),
    status: "running",
    started_at: requireNonEmptyString(input.started_at, "started_at"),
  };
}

export function succeedAgentRun(run: AgentRun, output: string, finishedAt: string): AgentRun {
  if (run.status !== "running") {
    throw new AppError("INVALID_STATE", `agent run cannot transition from ${run.status} to succeeded`, {
      details: { run_id: run.id, from: run.status, to: "succeeded" },
    });
  }

  return {
    ...run,
    status: "succeeded",
    output: requireNonEmptyString(output, "output"),
    finished_at: requireNonEmptyString(finishedAt, "finished_at"),
    error_code: undefined,
    error_message: undefined,
  };
}

export function failAgentRun(run: AgentRun, errorCode: string, errorMessage: string, finishedAt: string): AgentRun {
  if (run.status !== "running") {
    throw new AppError("INVALID_STATE", `agent run cannot transition from ${run.status} to failed`, {
      details: { run_id: run.id, from: run.status, to: "failed" },
    });
  }

  return {
    ...run,
    status: requireOneOf("failed", "status", ["running", "succeeded", "failed"] as const),
    error_code: requireNonEmptyString(errorCode, "error_code"),
    error_message: requireNonEmptyString(errorMessage, "error_message"),
    finished_at: requireNonEmptyString(finishedAt, "finished_at"),
  };
}
