import type { SqliteStatementExecutor } from "../../../infrastructure/db/sqlite-executor";
import type { OrchestrationRunsRepository } from "../application/ports/orchestration-runs-repository";
import type { OrchestrationRun } from "../domain/orchestration-run";

export class SqliteOrchestrationRunsRepository implements OrchestrationRunsRepository {
  constructor(private readonly db: SqliteStatementExecutor) {}

  async findById(runId: string): Promise<OrchestrationRun | null> {
    return this.db.get<OrchestrationRun>(
      `SELECT
        id, workspace_id, account_id, trigger_kind, eligible_actions_json, chosen_action_json,
        status, error_code, error_message, created_at, finished_at
      FROM orchestration_runs
      WHERE id = ?`,
      [runId],
    );
  }

  async listRecentByAccountId(accountId: string, limit: number): Promise<OrchestrationRun[]> {
    return this.db.all<OrchestrationRun>(
      `SELECT
        id, workspace_id, account_id, trigger_kind, eligible_actions_json, chosen_action_json,
        status, error_code, error_message, created_at, finished_at
      FROM orchestration_runs
      WHERE account_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT ?`,
      [accountId, limit],
    );
  }

  async create(run: OrchestrationRun): Promise<void> {
    this.db.run(
      `INSERT INTO orchestration_runs (
        id, workspace_id, account_id, trigger_kind, eligible_actions_json, chosen_action_json,
        status, error_code, error_message, created_at, finished_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        run.id,
        run.workspace_id,
        run.account_id,
        run.trigger_kind,
        run.eligible_actions_json,
        run.chosen_action_json ?? null,
        run.status,
        run.error_code ?? null,
        run.error_message ?? null,
        run.created_at,
        run.finished_at ?? null,
      ],
    );
  }

  async save(run: OrchestrationRun): Promise<void> {
    this.db.run(
      `UPDATE orchestration_runs
      SET eligible_actions_json = ?, chosen_action_json = ?, status = ?, error_code = ?, error_message = ?, finished_at = ?
      WHERE id = ?`,
      [
        run.eligible_actions_json,
        run.chosen_action_json ?? null,
        run.status,
        run.error_code ?? null,
        run.error_message ?? null,
        run.finished_at ?? null,
        run.id,
      ],
    );
  }
}
