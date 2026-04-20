import type { AuditLog } from "../../modules/audit/domain/audit-log";

export interface AuditLogsResponse {
  items: AuditLog[];
}
