import type { AgentTask } from "../../modules/agent-runtime/domain/agent-task";
import type { AgentRun } from "../../modules/agent-runtime/domain/agent-run";
import type { ModelRequest } from "../../modules/agent-runtime/domain/model-request";
import type { ModelRequestAttempt } from "../../modules/agent-runtime/domain/model-request-attempt";
import type { ToolCall } from "../../modules/agent-runtime/domain/tool-call";
import type { Alert } from "../../modules/monitoring/domain/alert";
import type { AuditLog } from "../../modules/audit/domain/audit-log";
import type { ConnectorRequest } from "../../modules/connector-x/domain/connector-request";

export interface ClassifyInboxThreadResponse {
  task_id: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
}

export interface AgentTaskDetailResponse {
  task: AgentTask;
  latest_run?: AgentRun;
}

export interface AgentRunDetailResponse {
  run: AgentRun;
  model_request?: ModelRequest;
  attempts: ModelRequestAttempt[];
  tool_calls: ToolCall[];
}

export interface AgentRunTraceResponse {
  request_id?: string;
  task: AgentTask;
  run: AgentRun;
  model_request?: ModelRequest;
  attempts: ModelRequestAttempt[];
  tool_calls: ToolCall[];
  alerts: Alert[];
  audit_logs: AuditLog[];
  connector_requests: ConnectorRequest[];
  sibling_runs: AgentRun[];
}
