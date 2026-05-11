import type { AuditLog } from "../../domain/audit-log";

export interface AuditLogRepository {
  append(log: AuditLog): Promise<void>;
  listByWorkspaceId(workspaceId: string, limit: number, entityType?: string, entityId?: string): Promise<AuditLog[]>;
  listByRequestId(requestId: string): Promise<AuditLog[]>;
}
