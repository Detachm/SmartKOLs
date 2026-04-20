import type { SqliteExecutor } from "../../../infrastructure/db/sqlite-executor";
import type { TrendsRepository } from "../application/ports/trends-repository";
import type { Trend } from "../domain/trend";

export class SqliteTrendsRepository implements TrendsRepository {
  constructor(private readonly db: SqliteExecutor) {}

  async findById(trendId: string): Promise<Trend | null> {
    return this.db.get<Trend>(
      `SELECT id, workspace_id, topic, category, score, status, detected_at, updated_at
      FROM trends
      WHERE id = ?`,
      [trendId],
    );
  }

  async findByWorkspaceAndTopic(workspaceId: string, topic: string): Promise<Trend | null> {
    return this.db.get<Trend>(
      `SELECT id, workspace_id, topic, category, score, status, detected_at, updated_at
      FROM trends
      WHERE workspace_id = ? AND topic = ?`,
      [workspaceId, topic],
    );
  }

  async listByWorkspaceId(workspaceId: string): Promise<Trend[]> {
    return this.db.all<Trend>(
      `SELECT id, workspace_id, topic, category, score, status, detected_at, updated_at
      FROM trends
      WHERE workspace_id = ?
      ORDER BY score DESC, updated_at DESC`,
      [workspaceId],
    );
  }

  async save(trend: Trend): Promise<void> {
    this.db.run(
      `INSERT INTO trends (
        id, workspace_id, topic, category, score, status, detected_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        topic = excluded.topic,
        category = excluded.category,
        score = excluded.score,
        status = excluded.status,
        updated_at = excluded.updated_at`,
      [
        trend.id,
        trend.workspace_id,
        trend.topic,
        trend.category,
        trend.score,
        trend.status,
        trend.detected_at,
        trend.updated_at,
      ],
    );
  }
}
