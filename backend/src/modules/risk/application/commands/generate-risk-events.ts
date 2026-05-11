import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { AlertsRepository } from "../../../monitoring/application/ports/alerts-repository";
import { createAlert } from "../../../monitoring/domain/alert";
import type { NotificationsRepository } from "../../../notifications/application/ports/notifications-repository";
import { createNotification } from "../../../notifications/domain/notification";
import type { RiskEventsRepository } from "../ports/risk-events-repository";
import { createRiskEvent } from "../../domain/risk-event";

export interface GenerateRiskEventsDependencies {
  riskEvents: RiskEventsRepository;
  alerts: AlertsRepository;
  notifications: NotificationsRepository;
  clock: Clock;
}

export class GenerateRiskEvents {
  constructor(private readonly deps: GenerateRiskEventsDependencies) {}

  async execute(input: {
    workspace_id: string;
    account_id: string;
    severity: "low" | "medium" | "high";
    code: string;
    title: string;
    detail: string;
  }) {
    const createdAt = this.deps.clock.now().toISOString();
    const event = createRiskEvent({
      id: newId(),
      workspace_id: input.workspace_id,
      account_id: input.account_id,
      severity: input.severity,
      code: input.code,
      title: input.title,
      detail: input.detail,
      created_at: createdAt,
    });

    await this.deps.riskEvents.create(event);
    await this.deps.alerts.create(createAlert({
      id: newId(),
      workspace_id: input.workspace_id,
      severity: input.severity === "high" ? "critical" : input.severity === "medium" ? "warning" : "info",
      source_type: "risk",
      source_id: event.id,
      code: input.code,
      message: input.title,
      payload: JSON.stringify(event),
      created_at: createdAt,
    }));
    await this.deps.notifications.create(createNotification({
      id: newId(),
      workspace_id: input.workspace_id,
      type: "health",
      title: input.title,
      body: input.detail,
      link: `/accounts/${input.account_id}`,
      created_at: createdAt,
    }));

    return event;
  }
}
