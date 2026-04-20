import { requireNonEmptyString, requireOneOf } from "../../../core/validation/guards";

export type ModelRequestStatus = "running" | "succeeded" | "failed" | "invalid_output";

export interface ModelRequest {
  id: string;
  workspace_id: string;
  request_id?: string;
  agent_run_id?: string;
  provider: string;
  model_name: string;
  request_schema_version: string;
  prompt_artifact_ref?: string;
  tool_spec_ref?: string;
  status: ModelRequestStatus;
  started_at: string;
  finished_at?: string;
}

export function createModelRequest(input: Omit<ModelRequest, "status">): ModelRequest {
  return {
    id: requireNonEmptyString(input.id, "id"),
    workspace_id: requireNonEmptyString(input.workspace_id, "workspace_id"),
    request_id: input.request_id?.trim() || undefined,
    agent_run_id: input.agent_run_id?.trim() || undefined,
    provider: requireNonEmptyString(input.provider, "provider"),
    model_name: requireNonEmptyString(input.model_name, "model_name"),
    request_schema_version: requireNonEmptyString(input.request_schema_version, "request_schema_version"),
    prompt_artifact_ref: input.prompt_artifact_ref?.trim() || undefined,
    tool_spec_ref: input.tool_spec_ref?.trim() || undefined,
    status: requireOneOf("running", "status", ["running", "succeeded", "failed", "invalid_output"] as const),
    started_at: requireNonEmptyString(input.started_at, "started_at"),
    finished_at: input.finished_at?.trim() || undefined,
  };
}
