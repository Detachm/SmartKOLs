import type { AuditLogRepository } from "../ports/audit-log-repository";

export interface ListAuditLogsDependencies {
  auditLogs: AuditLogRepository;
}

export class ListAuditLogs {
  constructor(private readonly deps: ListAuditLogsDependencies) {}

  async execute(workspaceId: string, limit: number, entityType?: string, entityId?: string) {
    return {
      items: await this.deps.auditLogs.listByWorkspaceId(workspaceId, limit, entityType, entityId),
    };
  }
}
