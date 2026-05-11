import { requireNonEmptyString, requireOneOf } from "../../../core/validation/guards";

export type AlertSeverity = "info" | "warning" | "critical";
export type AlertSourceType = "connector" | "runtime" | "publish" | "risk";

export interface Alert {
  id: string;
  workspace_id: string;
  request_id?: string;
  severity: AlertSeverity;
  source_type: AlertSourceType;
  source_id: string;
  code: string;
  message: string;
  payload?: string;
  created_at: string;
}

export function createAlert(alert: Alert): Alert {
  return {
    id: requireNonEmptyString(alert.id, "id"),
    workspace_id: requireNonEmptyString(alert.workspace_id, "workspace_id"),
    request_id: alert.request_id?.trim() || undefined,
    severity: requireOneOf(alert.severity, "severity", ["info", "warning", "critical"] as const),
    source_type: requireOneOf(alert.source_type, "source_type", ["connector", "runtime", "publish", "risk"] as const),
    source_id: requireNonEmptyString(alert.source_id, "source_id"),
    code: requireNonEmptyString(alert.code, "code"),
    message: requireNonEmptyString(alert.message, "message"),
    payload: alert.payload?.trim() || undefined,
    created_at: requireNonEmptyString(alert.created_at, "created_at"),
  };
}
