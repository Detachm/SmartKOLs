import type { SqliteStatementExecutor } from "../../../infrastructure/db/sqlite-executor";
import type {
  AccountAutomationTickCandidate,
  AccountOrchestrationStatesRepository,
} from "../application/ports/account-orchestration-states-repository";
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

  async listDueAutomationTickCandidates(input: {
    now: string;
    stale_before: string;
    limit: number;
  }): Promise<AccountAutomationTickCandidate[]> {
    return this.db.all<AccountAutomationTickCandidate>(
      `SELECT
        a.id AS account_id,
        a.workspace_id,
        s.status,
        s.next_tick_after,
        s.last_tick_at,
        s.active_run_id
      FROM accounts a
      LEFT JOIN account_orchestration_states s ON s.account_id = a.id
      WHERE a.status = 'active'
        AND (
          EXISTS (
            SELECT 1 FROM autopost_policies ap
            WHERE ap.account_id = a.id AND ap.status = 'active'
          )
          OR EXISTS (
            SELECT 1 FROM recurring_brief_plans rbp
            WHERE rbp.account_id = a.id AND rbp.status = 'active'
          )
          OR EXISTS (
            SELECT 1 FROM engagement_policies ep
            WHERE ep.account_id = a.id AND ep.status = 'active'
          )
        )
        AND COALESCE(s.status, 'active') = 'active'
        AND s.active_run_id IS NULL
        AND (
          s.account_id IS NULL
          OR (s.next_tick_after IS NOT NULL AND s.next_tick_after <= ?)
          OR (s.next_tick_after IS NULL AND s.last_tick_at IS NULL)
          OR (s.next_tick_after IS NULL AND s.last_tick_at <= ?)
        )
      ORDER BY COALESCE(s.next_tick_after, s.last_tick_at, a.created_at) ASC, a.id ASC
      LIMIT ?`,
      [input.now, input.stale_before, input.limit],
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
