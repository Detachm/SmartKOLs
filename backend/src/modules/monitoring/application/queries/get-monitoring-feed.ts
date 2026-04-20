import type { AlertsRepository } from "../ports/alerts-repository";
import type { NotificationsRepository } from "../../../notifications/application/ports/notifications-repository";
import type { RiskEventsRepository } from "../../../risk/application/ports/risk-events-repository";

export interface MonitoringFeedItem {
  id: string;
  kind: "alert" | "notification" | "risk_event";
  created_at: string;
  title: string;
  detail: string;
  severity?: string;
}

export interface GetMonitoringFeedDependencies {
  alerts: AlertsRepository;
  notifications: NotificationsRepository;
  riskEvents: RiskEventsRepository;
}

export class GetMonitoringFeed {
  constructor(private readonly deps: GetMonitoringFeedDependencies) {}

  async execute(workspaceId: string, limit: number) {
    const [alerts, notifications, riskEvents] = await Promise.all([
      this.deps.alerts.listByWorkspaceId(workspaceId, limit),
      this.deps.notifications.listByWorkspaceId(workspaceId, limit),
      this.deps.riskEvents.listByWorkspaceId(workspaceId, limit),
    ]);

    const items: MonitoringFeedItem[] = [
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
    ].sort((left, right) => right.created_at.localeCompare(left.created_at)).slice(0, limit);

    return { items };
  }
}
