import type { SqliteExecutor } from "../../../infrastructure/db/sqlite-executor";
import type { HealthScoreFactorsRepository } from "../application/ports/health-score-factors-repository";
import type { HealthScoreFactor } from "../domain/health-score-factor";

export class SqliteHealthScoreFactorsRepository implements HealthScoreFactorsRepository {
  constructor(private readonly db: SqliteExecutor) {}

  async replaceForHealthScore(healthScoreId: string, factors: HealthScoreFactor[]): Promise<void> {
    this.db.transaction((tx) => {
      tx.run(`DELETE FROM health_score_factors WHERE health_score_id = ?`, [healthScoreId]);
      for (const factor of factors) {
        tx.run(
          `INSERT INTO health_score_factors (
            id, health_score_id, factor_code, contribution, description
          ) VALUES (?, ?, ?, ?, ?)`,
          [
            factor.id,
            factor.health_score_id,
            factor.factor_code,
            factor.contribution,
            factor.description,
          ],
        );
      }
    });
  }

  async listByHealthScoreId(healthScoreId: string): Promise<HealthScoreFactor[]> {
    return this.db.all<HealthScoreFactor>(
      `SELECT id, health_score_id, factor_code, contribution, description
      FROM health_score_factors
      WHERE health_score_id = ?
      ORDER BY ABS(contribution) DESC, factor_code ASC`,
      [healthScoreId],
    );
  }
}
