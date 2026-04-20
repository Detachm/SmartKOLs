import type { SqliteStatementExecutor } from "../../../infrastructure/db/sqlite-executor";
import type { AccountOrchestrationStatesRepository } from "../application/ports/account-orchestration-states-repository";
import type { AccountOrchestrationState } from "../domain/account-orchestration-state";

export class SqliteAccountOrchestrationStatesRepository implements AccountOrchestrationStatesRepository {
  constructor(private readonly db: SqliteStatementExecutor) {}

  async findByAccountId(accountId: string): Promise<AccountOrchestrationState | null> {
    return this.db.get<AccountOrchestrationState>(
      `SELECT
        account_id, workspace_id, status, next_tick_after, last_tick_at, active_run_id,
        last_decision_type, last_reason_code, created_at, updated_at
      FROM account_orchestration_states
      WHERE account_id = ?`,
      [accountId],
    );
  }

  async save(state: AccountOrchestrationState): Promise<void> {
    this.db.run(
      `INSERT INTO account_orchestration_states (
        account_id, workspace_id, status, next_tick_after, last_tick_at, active_run_id,
        last_decision_type, last_reason_code, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(account_id) DO UPDATE SET
        workspace_id = excluded.workspace_id,
        status = excluded.status,
        next_tick_after = excluded.next_tick_after,
        last_tick_at = excluded.last_tick_at,
        active_run_id = excluded.active_run_id,
        last_decision_type = excluded.last_decision_type,
        last_reason_code = excluded.last_reason_code,
        updated_at = excluded.updated_at`,
      [
        state.account_id,
        state.workspace_id,
        state.status,
        state.next_tick_after ?? null,
        state.last_tick_at ?? null,
        state.active_run_id ?? null,
        state.last_decision_type ?? null,
        state.last_reason_code ?? null,
        state.created_at,
        state.updated_at,
      ],
    );
  }
}
