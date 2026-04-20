import { requireNonEmptyString, requireOneOf } from "../../../core/validation/guards";

export type RiskEventSeverity = "low" | "medium" | "high";

export interface RiskEvent {
  id: string;
  workspace_id: string;
  account_id: string;
  severity: RiskEventSeverity;
  code: string;
  title: string;
  detail: string;
  created_at: string;
}

export function createRiskEvent(event: RiskEvent): RiskEvent {
  return {
    id: requireNonEmptyString(event.id, "id"),
    workspace_id: requireNonEmptyString(event.workspace_id, "workspace_id"),
    account_id: requireNonEmptyString(event.account_id, "account_id"),
    severity: requireOneOf(event.severity, "severity", ["low", "medium", "high"] as const),
    code: requireNonEmptyString(event.code, "code"),
    title: requireNonEmptyString(event.title, "title"),
    detail: requireNonEmptyString(event.detail, "detail"),
    created_at: requireNonEmptyString(event.created_at, "created_at"),
  };
}
