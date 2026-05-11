import type { SqliteExecutor } from "../../../infrastructure/db/sqlite-executor";
import type { AutopostPoliciesRepository } from "../application/ports/autopost-policies-repository";
import type { AutopostPolicy } from "../domain/autopost-policy";

export class SqliteAutopostPoliciesRepository implements AutopostPoliciesRepository {
  constructor(private readonly db: SqliteExecutor) {}

  async findById(policyId: string): Promise<AutopostPolicy | null> {
    const row = this.db.get<Row>(
      `SELECT
        id, workspace_id, account_id, cadence_body, content_strategy_body, execution_body, status,
        next_run_after, last_attempted_at, last_run_status, last_failed_at, last_error_code,
        last_error_message, last_enqueued_at, last_run_id, updated_at
      FROM autopost_policies
      WHERE id = ?`,
      [policyId],
    );

    return row ? mapRow(row) : null;
  }

  async findByAccountId(accountId: string): Promise<AutopostPolicy | null> {
    const row = this.db.get<Row>(
      `SELECT
        id, workspace_id, account_id, cadence_body, content_strategy_body, execution_body, status,
        next_run_after, last_attempted_at, last_run_status, last_failed_at, last_error_code,
        last_error_message, last_enqueued_at, last_run_id, updated_at
      FROM autopost_policies
      WHERE account_id = ?`,
      [accountId],
    );

    return row ? mapRow(row) : null;
  }

  async listActiveScheduled(): Promise<AutopostPolicy[]> {
    const rows = this.db.all<Row>(
      `SELECT
        id, workspace_id, account_id, cadence_body, content_strategy_body, execution_body, status,
        next_run_after, last_attempted_at, last_run_status, last_failed_at, last_error_code,
        last_error_message, last_enqueued_at, last_run_id, updated_at
      FROM autopost_policies
      WHERE status = 'active' AND next_run_after IS NOT NULL
      ORDER BY next_run_after ASC, updated_at DESC`,
    );

    return rows.map(mapRow);
  }

  async save(policy: AutopostPolicy): Promise<void> {
    this.db.run(
      `INSERT INTO autopost_policies (
        id, workspace_id, account_id, cadence_body, content_strategy_body, execution_body, status,
        next_run_after, last_attempted_at, last_run_status, last_failed_at, last_error_code,
        last_error_message, last_enqueued_at, last_run_id, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(account_id) DO UPDATE SET
        cadence_body = excluded.cadence_body,
        content_strategy_body = excluded.content_strategy_body,
        execution_body = excluded.execution_body,
        status = excluded.status,
        next_run_after = excluded.next_run_after,
        last_attempted_at = excluded.last_attempted_at,
        last_run_status = excluded.last_run_status,
        last_failed_at = excluded.last_failed_at,
        last_error_code = excluded.last_error_code,
        last_error_message = excluded.last_error_message,
        last_enqueued_at = excluded.last_enqueued_at,
        last_run_id = excluded.last_run_id,
        updated_at = excluded.updated_at`,
      [
        policy.id,
        policy.workspace_id,
        policy.account_id,
        JSON.stringify(policy.cadence_body),
        JSON.stringify(policy.content_strategy_body),
        JSON.stringify(policy.execution_body),
        policy.status,
        policy.next_run_after ?? null,
        policy.last_attempted_at ?? null,
        policy.last_run_status ?? null,
        policy.last_failed_at ?? null,
        policy.last_error_code ?? null,
        policy.last_error_message ?? null,
        policy.last_enqueued_at ?? null,
        policy.last_run_id ?? null,
        policy.updated_at,
      ],
    );
  }
}

interface Row {
  id: string;
  workspace_id: string;
  account_id: string;
  cadence_body: string;
  content_strategy_body: string;
  execution_body: string;
  status: AutopostPolicy["status"];
  next_run_after?: string | null;
  last_attempted_at?: string | null;
  last_run_status?: AutopostPolicy["last_run_status"] | null;
  last_failed_at?: string | null;
  last_error_code?: string | null;
  last_error_message?: string | null;
  last_enqueued_at?: string | null;
  last_run_id?: string | null;
  updated_at: string;
}

function mapRow(row: Row): AutopostPolicy {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    account_id: row.account_id,
    cadence_body: JSON.parse(row.cadence_body) as AutopostPolicy["cadence_body"],
    content_strategy_body: JSON.parse(row.content_strategy_body) as AutopostPolicy["content_strategy_body"],
    execution_body: JSON.parse(row.execution_body) as AutopostPolicy["execution_body"],
    status: row.status,
    next_run_after: row.next_run_after ?? undefined,
    last_attempted_at: row.last_attempted_at ?? undefined,
    last_run_status: row.last_run_status ?? undefined,
    last_failed_at: row.last_failed_at ?? undefined,
    last_error_code: row.last_error_code ?? undefined,
    last_error_message: row.last_error_message ?? undefined,
    last_enqueued_at: row.last_enqueued_at ?? undefined,
    last_run_id: row.last_run_id ?? undefined,
    updated_at: row.updated_at,
  };
}
