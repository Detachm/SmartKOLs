import type { SqliteExecutor } from "../../../infrastructure/db/sqlite-executor";
import type { RecurringBriefPlansRepository } from "../application/ports/recurring-brief-plans-repository";
import type { RecurringBriefPlan } from "../domain/editorial";

export class SqliteRecurringBriefPlansRepository implements RecurringBriefPlansRepository {
  constructor(private readonly db: SqliteExecutor) {}

  async findById(planId: string): Promise<RecurringBriefPlan | null> {
    const row = this.db.get<Row>(
      `SELECT
        id, workspace_id, account_id, name, description, cadence_body, strategy_body, status,
        next_run_after, last_attempted_at, last_run_status, last_failed_at, last_error_code, last_error_message,
        last_enqueued_at, last_brief_id, created_at, updated_at
      FROM recurring_brief_plans
      WHERE id = ?`,
      [planId],
    );

    return row ? mapRow(row) : null;
  }

  async listByAccountId(accountId: string): Promise<RecurringBriefPlan[]> {
    const rows = this.db.all<Row>(
      `SELECT
        id, workspace_id, account_id, name, description, cadence_body, strategy_body, status,
        next_run_after, last_attempted_at, last_run_status, last_failed_at, last_error_code, last_error_message,
        last_enqueued_at, last_brief_id, created_at, updated_at
      FROM recurring_brief_plans
      WHERE account_id = ?
      ORDER BY updated_at DESC, created_at DESC`,
      [accountId],
    );

    return rows.map(mapRow);
  }

  async listActiveScheduled(): Promise<RecurringBriefPlan[]> {
    const rows = this.db.all<Row>(
      `SELECT
        id, workspace_id, account_id, name, description, cadence_body, strategy_body, status,
        next_run_after, last_attempted_at, last_run_status, last_failed_at, last_error_code, last_error_message,
        last_enqueued_at, last_brief_id, created_at, updated_at
      FROM recurring_brief_plans
      WHERE status = 'active' AND next_run_after IS NOT NULL
      ORDER BY next_run_after ASC, updated_at DESC`,
    );

    return rows.map(mapRow);
  }

  async listByWatchlistId(watchlistId: string): Promise<RecurringBriefPlan[]> {
    const rows = this.db.all<Row>(
      `SELECT
        id, workspace_id, account_id, name, description, cadence_body, strategy_body, status,
        next_run_after, last_attempted_at, last_run_status, last_failed_at, last_error_code, last_error_message,
        last_enqueued_at, last_brief_id, created_at, updated_at
      FROM recurring_brief_plans
      WHERE json_extract(strategy_body, '$.watchlist_id') = ?
      ORDER BY updated_at DESC, created_at DESC`,
      [watchlistId],
    );

    return rows.map(mapRow);
  }

  async save(plan: RecurringBriefPlan): Promise<void> {
    this.db.run(
      `INSERT INTO recurring_brief_plans (
        id, workspace_id, account_id, name, description, cadence_body, strategy_body, status,
        next_run_after, last_attempted_at, last_run_status, last_failed_at, last_error_code, last_error_message,
        last_enqueued_at, last_brief_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        cadence_body = excluded.cadence_body,
        strategy_body = excluded.strategy_body,
        status = excluded.status,
        next_run_after = excluded.next_run_after,
        last_attempted_at = excluded.last_attempted_at,
        last_run_status = excluded.last_run_status,
        last_failed_at = excluded.last_failed_at,
        last_error_code = excluded.last_error_code,
        last_error_message = excluded.last_error_message,
        last_enqueued_at = excluded.last_enqueued_at,
        last_brief_id = excluded.last_brief_id,
        updated_at = excluded.updated_at`,
      [
        plan.id,
        plan.workspace_id,
        plan.account_id,
        plan.name,
        plan.description ?? null,
        JSON.stringify(plan.cadence_body),
        JSON.stringify(plan.strategy_body),
        plan.status,
        plan.next_run_after ?? null,
        plan.last_attempted_at ?? null,
        plan.last_run_status ?? null,
        plan.last_failed_at ?? null,
        plan.last_error_code ?? null,
        plan.last_error_message ?? null,
        plan.last_enqueued_at ?? null,
        plan.last_brief_id ?? null,
        plan.created_at,
        plan.updated_at,
      ],
    );
  }

  async delete(planId: string): Promise<void> {
    this.db.run(`DELETE FROM recurring_brief_plans WHERE id = ?`, [planId]);
  }
}

interface Row {
  id: string;
  workspace_id: string;
  account_id: string;
  name: string;
  description?: string | null;
  cadence_body: string;
  strategy_body: string;
  status: RecurringBriefPlan["status"];
  next_run_after?: string | null;
  last_attempted_at?: string | null;
  last_run_status?: RecurringBriefPlan["last_run_status"] | null;
  last_failed_at?: string | null;
  last_error_code?: string | null;
  last_error_message?: string | null;
  last_enqueued_at?: string | null;
  last_brief_id?: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: Row): RecurringBriefPlan {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    account_id: row.account_id,
    name: row.name,
    description: row.description ?? undefined,
    cadence_body: JSON.parse(row.cadence_body) as RecurringBriefPlan["cadence_body"],
    strategy_body: JSON.parse(row.strategy_body) as RecurringBriefPlan["strategy_body"],
    status: row.status,
    next_run_after: row.next_run_after ?? undefined,
    last_attempted_at: row.last_attempted_at ?? undefined,
    last_run_status: row.last_run_status ?? undefined,
    last_failed_at: row.last_failed_at ?? undefined,
    last_error_code: row.last_error_code ?? undefined,
    last_error_message: row.last_error_message ?? undefined,
    last_enqueued_at: row.last_enqueued_at ?? undefined,
    last_brief_id: row.last_brief_id ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
