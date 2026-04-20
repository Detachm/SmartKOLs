import { requireIntegerInRange, requireNonEmptyString } from "../../../../core/validation/guards";
import type { Clock } from "../../../../core/time/clock";
import { RECENT_CRITICAL_EVENT_WINDOW_MS } from "../../../operations/domain/operations-policy";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { AgentRuntimeRepository } from "../../../agent-runtime/application/ports/agent-runtime-repository";
import type { ConnectorRequestRepository } from "../../../connector-x/application/ports/connector-request-repository";
import type { NotificationsRepository } from "../../../notifications/application/ports/notifications-repository";
import type { RiskEventsRepository } from "../../../risk/application/ports/risk-events-repository";
import type {
  MonitoringAgentTraceSummary,
  MonitoringOperatorQueueItem,
  MonitoringOperatorQueueKindSummary,
  MonitoringOverviewResponse,
} from "../../../../contracts/api/monitoring";
import type { OperationsOverviewResponse } from "../../../../contracts/api/operations";
import type { AlertsRepository } from "../ports/alerts-repository";
import type { AlertChannelsRepository } from "../../../alert-channels/application/ports/alert-channels-repository";

export interface MonitoringAgentTraceReadModel {
  listByWorkspaceId(workspaceId: string, limit: number): Promise<MonitoringAgentTraceSummary[]>;
}

export interface MonitoringOperatorQueueReadModel {
  listByWorkspaceId(workspaceId: string, limit: number): Promise<MonitoringOperatorQueueItem[]>;
  summarizeByWorkspaceId(workspaceId: string): Promise<MonitoringOperatorQueueKindSummary[]>;
  listRetryableFailedByWorkspaceId(workspaceId: string, kind: MonitoringOperatorQueueItem["kind"], limit: number): Promise<MonitoringOperatorQueueItem[]>;
}

export interface MonitoringOperationsReadModel {
  getOverview(input: {
    event_limit: number;
    checked_at: string;
    stale_after_ms: number;
    recent_critical_event_window_ms: number;
  }): Promise<OperationsOverviewResponse>;
}

export interface GetMonitoringOverviewDependencies {
  alerts: AlertsRepository;
  notifications: NotificationsRepository;
  riskEvents: RiskEventsRepository;
  connectorRequests: ConnectorRequestRepository;
  runtime: AgentRuntimeRepository;
  agentTraces: MonitoringAgentTraceReadModel;
  operatorQueues: MonitoringOperatorQueueReadModel;
  alertChannels: AlertChannelsRepository;
  auditLogs: AuditLogRepository;
  operations: MonitoringOperationsReadModel;
  clock: Clock;
}

export class GetMonitoringOverview {
  constructor(private readonly deps: GetMonitoringOverviewDependencies) {}

  async execute(workspaceId: string, limit = 20): Promise<MonitoringOverviewResponse> {
    const normalizedWorkspaceId = requireNonEmptyString(workspaceId, "workspace_id");
    const normalizedLimit = requireIntegerInRange(limit, "limit", 1, 100);

    const [alerts, notifications, riskEvents, connectorRequests, modelRequests, agentTraces, operatorQueueSummary, operatorQueues, alertChannels, auditLogs, operations] = await Promise.all([
      this.deps.alerts.listByWorkspaceId(normalizedWorkspaceId, normalizedLimit),
      this.deps.notifications.listByWorkspaceId(normalizedWorkspaceId, normalizedLimit),
      this.deps.riskEvents.listByWorkspaceId(normalizedWorkspaceId, normalizedLimit),
      this.deps.connectorRequests.listByWorkspaceId(normalizedWorkspaceId, normalizedLimit),
      this.deps.runtime.listModelRequestsByWorkspaceId(normalizedWorkspaceId, normalizedLimit),
      this.deps.agentTraces.listByWorkspaceId(normalizedWorkspaceId, normalizedLimit),
      this.deps.operatorQueues.summarizeByWorkspaceId(normalizedWorkspaceId),
      this.deps.operatorQueues.listByWorkspaceId(normalizedWorkspaceId, normalizedLimit),
      this.deps.alertChannels.listByWorkspaceId(normalizedWorkspaceId, normalizedLimit),
      this.deps.auditLogs.listByWorkspaceId(normalizedWorkspaceId, normalizedLimit),
      this.deps.operations.getOverview({
        event_limit: normalizedLimit,
        checked_at: this.deps.clock.now().toISOString(),
        stale_after_ms: 45_000,
        recent_critical_event_window_ms: RECENT_CRITICAL_EVENT_WINDOW_MS,
      }),
    ]);

    const feed = [
      ...alerts.map((alert) => ({
        id: alert.id,
        kind: "alert" as const,
        created_at: alert.created_at,
        title: alert.code,
        detail: alert.message,
        severity: alert.severity,
      })),
      ...notifications.map((notification) => ({
        id: notification.id,
        kind: "notification" as const,
        created_at: notification.created_at,
        title: notification.title,
        detail: notification.body,
      })),
      ...riskEvents.map((event) => ({
        id: event.id,
        kind: "risk_event" as const,
        created_at: event.created_at,
        title: event.title,
        detail: event.detail,
        severity: event.severity,
      })),
    ].sort((left, right) => right.created_at.localeCompare(left.created_at)).slice(0, normalizedLimit);

    return {
      summary: {
        unread_notifications: notifications.filter((item) => !item.read_at).length,
        alert_items: feed.filter((item) => item.kind === "alert" || item.kind === "risk_event").length,
        configured_alert_channels: alertChannels.length,
        active_alert_channels: alertChannels.filter((item) => item.status === "active").length,
        failed_connector_requests: connectorRequests.filter((item) => item.status === "failed" || item.status === "rate_limited").length,
        failed_model_requests: modelRequests.filter((item) => item.status === "failed" || item.status === "invalid_output").length,
        agent_trace_items: agentTraces.length,
        failed_agent_traces: agentTraces.filter((item) => {
          return item.task.status === "failed"
            || item.task.status === "cancelled"
            || item.run?.status === "failed"
            || item.model_request?.status === "failed"
            || item.model_request?.status === "invalid_output";
        }).length,
        audit_items: auditLogs.length,
        operations_health_status: operations.summary.health_status,
        stale_processes: operations.summary.stale_processes,
        failed_queue_items: operatorQueueSummary.reduce((sum, item) => sum + item.failed_count, 0),
      },
      feed,
      notifications,
      connector_requests: connectorRequests,
      model_requests: modelRequests,
      agent_traces: agentTraces,
      operator_queue_summary: operatorQueueSummary,
      operator_queues: operatorQueues,
      alert_channels: alertChannels,
      audit_logs: auditLogs,
      operations,
    };
  }
}
