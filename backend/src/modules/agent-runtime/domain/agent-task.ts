import { AppError } from "../../../core/errors/app-error";
import { requireNonEmptyString, requireOneOf } from "../../../core/validation/guards";

export type AgentTaskStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export interface AgentTask {
  id: string;
  workspace_id: string;
  agent_definition_id: string;
  task_type: string;
  target_type: string;
  target_id: string;
  payload: string;
  status: AgentTaskStatus;
  error_code?: string;
  error_message?: string;
  started_at?: string;
  lease_expires_at?: string;
  finished_at?: string;
  created_at: string;
}

export function createAgentTask(input: Omit<AgentTask, "status">): AgentTask {
  return {
    id: requireNonEmptyString(input.id, "id"),
    workspace_id: requireNonEmptyString(input.workspace_id, "workspace_id"),
    agent_definition_id: requireNonEmptyString(input.agent_definition_id, "agent_definition_id"),
    task_type: requireNonEmptyString(input.task_type, "task_type"),
    target_type: requireNonEmptyString(input.target_type, "target_type"),
    target_id: requireNonEmptyString(input.target_id, "target_id"),
    payload: requireNonEmptyString(input.payload, "payload"),
    status: "queued",
    error_code: undefined,
    error_message: undefined,
    started_at: undefined,
    lease_expires_at: undefined,
    finished_at: undefined,
    created_at: requireNonEmptyString(input.created_at, "created_at"),
  };
}

export function startAgentTaskExecution(task: AgentTask, startedAt: string, leaseExpiresAt: string): AgentTask {
  if (task.status !== "queued") {
    throw new AppError("INVALID_STATE", `agent task cannot transition from ${task.status} to running`, {
      details: { task_id: task.id, from: task.status, to: "running" },
    });
  }

  return {
    ...task,
    status: "running",
    error_code: undefined,
    error_message: undefined,
    started_at: requireNonEmptyString(startedAt, "started_at"),
    lease_expires_at: requireNonEmptyString(leaseExpiresAt, "lease_expires_at"),
    finished_at: undefined,
  };
}

export function succeedAgentTask(task: AgentTask, finishedAt: string): AgentTask {
  if (task.status !== "running") {
    throw new AppError("INVALID_STATE", `agent task cannot transition from ${task.status} to succeeded`, {
      details: { task_id: task.id, from: task.status, to: "succeeded" },
    });
  }

  return {
    ...task,
    status: "succeeded",
    lease_expires_at: undefined,
    error_code: undefined,
    error_message: undefined,
    finished_at: requireNonEmptyString(finishedAt, "finished_at"),
  };
}

export function failAgentTask(task: AgentTask, finishedAt: string, errorCode: string, errorMessage: string): AgentTask {
  if (task.status !== "running") {
    throw new AppError("INVALID_STATE", `agent task cannot transition from ${task.status} to failed`, {
      details: { task_id: task.id, from: task.status, to: "failed" },
    });
  }

  return {
    ...task,
    status: "failed",
    error_code: requireNonEmptyString(errorCode, "error_code"),
    error_message: requireNonEmptyString(errorMessage, "error_message"),
    lease_expires_at: undefined,
    finished_at: requireNonEmptyString(finishedAt, "finished_at"),
  };
}

export function cancelAgentTask(task: AgentTask, finishedAt: string): AgentTask {
  if (task.status !== "queued") {
    throw new AppError("INVALID_STATE", `agent task cannot transition from ${task.status} to cancelled`, {
      details: { task_id: task.id, from: task.status, to: "cancelled" },
    });
  }

  return {
    ...task,
    status: "cancelled",
    lease_expires_at: undefined,
    finished_at: requireNonEmptyString(finishedAt, "finished_at"),
  };
}

export function retryAgentTask(task: AgentTask): AgentTask {
  if (task.status !== "failed") {
    throw new AppError("INVALID_STATE", `agent task cannot transition from ${task.status} to queued`, {
      details: { task_id: task.id, from: task.status, to: "queued" },
    });
  }

  return {
    ...task,
    status: "queued",
    error_code: undefined,
    error_message: undefined,
    started_at: undefined,
    lease_expires_at: undefined,
    finished_at: undefined,
  };
}

export function requireAgentTaskStatus(value: unknown): AgentTaskStatus {
  return requireOneOf(value, "status", ["queued", "running", "succeeded", "failed", "cancelled"] as const);
}
