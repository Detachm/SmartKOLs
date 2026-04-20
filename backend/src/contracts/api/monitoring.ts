import type { MonitoringFeedItem } from "../../modules/monitoring/application/queries/get-monitoring-feed";
import type { Notification } from "../../modules/notifications/domain/notification";
import type { ConnectorRequest } from "../../modules/connector-x/domain/connector-request";
import type { ModelRequest } from "../../modules/agent-runtime/domain/model-request";
import type { AuditLog } from "../../modules/audit/domain/audit-log";
import type { AgentTask } from "../../modules/agent-runtime/domain/agent-task";
import type { AgentRun } from "../../modules/agent-runtime/domain/agent-run";
import type { AlertChannel } from "../../modules/alert-channels/domain/alert-channel";
import type { OperationsOverviewResponse } from "./operations";

export type MonitoringOperatorQueueKind = "agent_task" | "worker_job" | "publish_job" | "source_fetch_run";

export interface MonitoringFeedResponse {
  items: MonitoringFeedItem[];
}

export interface MonitoringOverviewSummary {
  unread_notifications: number;
  alert_items: number;
  configured_alert_channels: number;
  active_alert_channels: number;
  failed_connector_requests: number;
  failed_model_requests: number;
  agent_trace_items: number;
  failed_agent_traces: number;
  audit_items: number;
  operations_health_status: OperationsOverviewResponse["summary"]["health_status"];
  stale_processes: number;
  failed_queue_items: number;
}

export interface MonitoringAgentTraceSummary {
  task: Pick<
    AgentTask,
    "id" | "task_type" | "target_type" | "target_id" | "status" | "error_code" | "error_message" | "created_at" | "started_at" | "finished_at"
  > & {
    agent_code: string;
  };
  run?: Pick<
    AgentRun,
    "id" | "request_id" | "run_no" | "model_name" | "status" | "error_code" | "error_message" | "started_at" | "finished_at"
  >;
  model_request?: Pick<
    ModelRequest,
    "id" | "provider" | "model_name" | "status" | "prompt_artifact_ref" | "tool_spec_ref" | "started_at" | "finished_at"
  >;
  stats: {
    tool_call_count: number;
    alert_count: number;
    audit_log_count: number;
    connector_request_count: number;
  };
}

export interface MonitoringOperatorQueueItem {
  kind: MonitoringOperatorQueueKind;
  id: string;
  workspace_id: string;
  status: "queued" | "running" | "failed" | "cancelled";
  title: string;
  subtitle: string;
  account_id?: string;
  error_code?: string;
  error_message?: string;
  created_at: string;
  run_after?: string;
  started_at?: string;
  lease_expires_at?: string;
  finished_at?: string;
  latest_run_id?: string;
  retry_supported: boolean;
}

export interface MonitoringOperatorQueueKindSummary {
  kind: MonitoringOperatorQueueKind;
  queued_count: number;
  running_count: number;
  failed_count: number;
  cancelled_count: number;
  retry_supported_failed_count: number;
  oldest_queued_at?: string;
  oldest_running_started_at?: string;
  oldest_failed_at?: string;
}

export interface RetryMonitoringQueueBacklogRequest {
  workspace_id: string;
  kinds?: MonitoringOperatorQueueKind[];
  limit?: number;
}

export interface RetryMonitoringQueueBacklogAttempt {
  kind: MonitoringOperatorQueueKind;
  source_id: string;
  retried_id?: string;
  status: "retried" | "failed";
  error_code?: string;
  error_message?: string;
}

export interface RetryMonitoringQueueBacklogKindResult {
  kind: MonitoringOperatorQueueKind;
  matched_failed_count: number;
  retried_count: number;
  failed_count: number;
}

export interface RetryMonitoringQueueBacklogResponse {
  workspace_id: string;
  requested_kinds: MonitoringOperatorQueueKind[];
  limit: number;
  summary: {
    matched_failed_items: number;
    retried_items: number;
    failed_items: number;
  };
  kinds: RetryMonitoringQueueBacklogKindResult[];
  attempts: RetryMonitoringQueueBacklogAttempt[];
}

export interface MonitoringOverviewResponse {
  summary: MonitoringOverviewSummary;
  feed: MonitoringFeedItem[];
  notifications: Notification[];
  connector_requests: ConnectorRequest[];
  model_requests: ModelRequest[];
  agent_traces: MonitoringAgentTraceSummary[];
  operator_queue_summary: MonitoringOperatorQueueKindSummary[];
  operator_queues: MonitoringOperatorQueueItem[];
  alert_channels: AlertChannel[];
  audit_logs: AuditLog[];
  operations: OperationsOverviewResponse;
}
