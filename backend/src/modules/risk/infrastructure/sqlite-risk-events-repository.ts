import type { SqliteExecutor } from "../../../infrastructure/db/sqlite-executor";
import type { RiskEventsRepository } from "../application/ports/risk-events-repository";
import type { RiskEvent } from "../domain/risk-event";

export class SqliteRiskEventsRepository implements RiskEventsRepository {
  constructor(private readonly db: SqliteExecutor) {}

  async create(event: RiskEvent): Promise<void> {
    this.db.run(
      `INSERT INTO risk_events (
        id, workspace_id, account_id, severity, code, title, detail, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event.id,
        event.workspace_id,
        event.account_id,
        event.severity,
        event.code,
        event.title,
        event.detail,
        event.created_at,
      ],
    );
  }

  async listByWorkspaceId(workspaceId: string, limit: number): Promise<RiskEvent[]> {
    return this.db.all<RiskEvent>(
      `SELECT id, workspace_id, account_id, severity, code, title, detail, created_at
      FROM risk_events
      WHERE workspace_id = ?
      ORDER BY created_at DESC
      LIMIT ?`,
      [workspaceId, limit],
    );
  }
}
