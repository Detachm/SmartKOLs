import type { SqliteExecutor } from "../../../infrastructure/db/sqlite-executor";
import type { HealthScoresRepository } from "../application/ports/health-scores-repository";
import type { HealthScore } from "../domain/health-score";

export class SqliteHealthScoresRepository implements HealthScoresRepository {
  constructor(private readonly db: SqliteExecutor) {}

  async save(score: HealthScore): Promise<void> {
    this.db.run(
      `INSERT INTO health_scores (
        id, workspace_id, account_id, score, risk_level, computed_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        score.id,
        score.workspace_id,
        score.account_id,
        score.score,
        score.risk_level,
        score.computed_at,
      ],
    );
  }

  async findLatestByAccountId(accountId: string): Promise<HealthScore | null> {
    return this.db.get<HealthScore>(
      `SELECT id, workspace_id, account_id, score, risk_level, computed_at
      FROM health_scores
      WHERE account_id = ?
      ORDER BY computed_at DESC
      LIMIT 1`,
      [accountId],
    );
  }
}
