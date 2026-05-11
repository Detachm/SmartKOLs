import type { SqliteStatementExecutor } from "../../../infrastructure/db/sqlite-executor";
import type { RequestContextStore } from "../../../core/request-context/request-context";
import type { AlertsRepository } from "../application/ports/alerts-repository";
import type { Alert } from "../domain/alert";

export class SqliteAlertsRepository implements AlertsRepository {
  constructor(
    private readonly db: SqliteStatementExecutor,
    private readonly requestContext: RequestContextStore,
  ) {}

  async create(alert: Alert): Promise<void> {
    this.createSync(alert);
  }

  createSync(alert: Alert): void {
    const requestId = alert.request_id ?? this.requestContext.getRequestId() ?? null;
    this.db.run(
      `INSERT INTO alerts (
        id, workspace_id, request_id, severity, source_type, source_id, code, message, payload, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        alert.id,
        alert.workspace_id,
        requestId,
        alert.severity,
        alert.source_type,
        alert.source_id,
        alert.code,
        alert.message,
        alert.payload ?? null,
        alert.created_at,
      ],
    );
  }

  async listByWorkspaceId(workspaceId: string, limit: number): Promise<Alert[]> {
    return this.db.all<Alert>(
      `SELECT id, workspace_id, request_id, severity, source_type, source_id, code, message, payload, created_at
      FROM alerts
      WHERE workspace_id = ?
      ORDER BY created_at DESC
      LIMIT ?`,
      [workspaceId, limit],
    );
  }

  async listByRequestId(requestId: string): Promise<Alert[]> {
    return this.db.all<Alert>(
      `SELECT id, workspace_id, request_id, severity, source_type, source_id, code, message, payload, created_at
      FROM alerts
      WHERE request_id = ?
      ORDER BY created_at ASC`,
      [requestId],
    );
  }
}
