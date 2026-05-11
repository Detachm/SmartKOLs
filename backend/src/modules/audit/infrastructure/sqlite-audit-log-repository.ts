import type { AuditLogRepository } from "../application/ports/audit-log-repository";
import type { AuditLog } from "../domain/audit-log";
import type { SqliteStatementExecutor } from "../../../infrastructure/db/sqlite-executor";
import type { RequestContextStore } from "../../../core/request-context/request-context";

export class SqliteAuditLogRepository implements AuditLogRepository {
  constructor(
    private readonly db: SqliteStatementExecutor,
    private readonly requestContext: RequestContextStore,
  ) {}

  async append(log: AuditLog): Promise<void> {
    this.appendSync(log);
  }

  appendSync(log: AuditLog): void {
    const requestId = log.request_id ?? this.requestContext.getRequestId() ?? null;
    this.db.run(
      `INSERT INTO audit_logs (
        id, workspace_id, request_id, actor_type, actor_id, entity_type, entity_id, action,
        before_state, after_state, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        log.id,
        log.workspace_id,
        requestId,
        log.actor_type,
        log.actor_id ?? null,
        log.entity_type,
        log.entity_id,
        log.action,
        log.before_state ?? null,
        log.after_state ?? null,
        log.created_at,
      ],
    );
  }

  async listByWorkspaceId(workspaceId: string, limit: number, entityType?: string, entityId?: string): Promise<AuditLog[]> {
    if (entityType && entityId) {
      return this.db.all<AuditLog>(
        `SELECT
          id, workspace_id, request_id, actor_type, actor_id, entity_type, entity_id, action,
          before_state, after_state, created_at
        FROM audit_logs
        WHERE workspace_id = ? AND entity_type = ? AND entity_id = ?
        ORDER BY created_at DESC
        LIMIT ?`,
        [workspaceId, entityType, entityId, limit],
      );
    }

    if (entityType) {
      return this.db.all<AuditLog>(
        `SELECT
          id, workspace_id, request_id, actor_type, actor_id, entity_type, entity_id, action,
          before_state, after_state, created_at
        FROM audit_logs
        WHERE workspace_id = ? AND entity_type = ?
        ORDER BY created_at DESC
        LIMIT ?`,
        [workspaceId, entityType, limit],
      );
    }

    return this.db.all<AuditLog>(
      `SELECT
        id, workspace_id, request_id, actor_type, actor_id, entity_type, entity_id, action,
        before_state, after_state, created_at
      FROM audit_logs
      WHERE workspace_id = ?
      ORDER BY created_at DESC
      LIMIT ?`,
      [workspaceId, limit],
    );
  }

  async listByRequestId(requestId: string): Promise<AuditLog[]> {
    return this.db.all<AuditLog>(
      `SELECT
        id, workspace_id, request_id, actor_type, actor_id, entity_type, entity_id, action,
        before_state, after_state, created_at
      FROM audit_logs
      WHERE request_id = ?
      ORDER BY created_at ASC`,
      [requestId],
    );
  }
}
