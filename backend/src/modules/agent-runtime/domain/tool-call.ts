import { requireNonEmptyString, requireOneOf } from "../../../core/validation/guards";

export type ToolCallStatus = "succeeded" | "failed";

export interface ToolCall {
  id: string;
  agent_run_id: string;
  request_id?: string;
  tool_name: string;
  request_payload: string;
  response_payload?: string;
  status: ToolCallStatus;
  started_at: string;
  finished_at?: string;
}

export function createToolCall(toolCall: ToolCall): ToolCall {
  return {
    id: requireNonEmptyString(toolCall.id, "id"),
    agent_run_id: requireNonEmptyString(toolCall.agent_run_id, "agent_run_id"),
    request_id: toolCall.request_id?.trim() || undefined,
    tool_name: requireNonEmptyString(toolCall.tool_name, "tool_name"),
    request_payload: requireNonEmptyString(toolCall.request_payload, "request_payload"),
    response_payload: toolCall.response_payload?.trim() || undefined,
    status: requireOneOf(toolCall.status, "status", ["succeeded", "failed"] as const),
    started_at: requireNonEmptyString(toolCall.started_at, "started_at"),
    finished_at: toolCall.finished_at?.trim() || undefined,
  };
}
