import type { SqliteExecutor } from "../../../infrastructure/db/sqlite-executor";
import type { AutopostRunsRepository } from "../application/ports/autopost-runs-repository";
import type { AutopostRun } from "../domain/autopost-run";

export class SqliteAutopostRunsRepository implements AutopostRunsRepository {
  constructor(private readonly db: SqliteExecutor) {}

  async findById(runId: string): Promise<AutopostRun | null> {
    const row = this.db.get<Row>(
      `SELECT
        id, policy_id, workspace_id, account_id, generation_mode, source_scope, scheduled_for, trend_id,
        brief_id, brief_task_id, draft_id, draft_task_id, schedule_id, publish_job_id, status,
        error_code, error_message, created_at, updated_at, finished_at
      FROM autopost_runs
      WHERE id = ?`,
      [runId],
    );

    return row ? mapRow(row) : null;
  }

  async findActiveByPolicyId(policyId: string): Promise<AutopostRun | null> {
    const row = this.db.get<Row>(
      `SELECT
        id, policy_id, workspace_id, account_id, generation_mode, source_scope, scheduled_for, trend_id,
        brief_id, brief_task_id, draft_id, draft_task_id, schedule_id, publish_job_id, status,
        error_code, error_message, created_at, updated_at, finished_at
      FROM autopost_runs
      WHERE policy_id = ? AND status IN ('queued', 'brief_generating', 'draft_generating')
      ORDER BY created_at DESC
      LIMIT 1`,
      [policyId],
    );

    return row ? mapRow(row) : null;
  }

  async findActiveByTaskId(taskId: string): Promise<AutopostRun | null> {
    const row = this.db.get<Row>(
      `SELECT
        id, policy_id, workspace_id, account_id, generation_mode, source_scope, scheduled_for, trend_id,
        brief_id, brief_task_id, draft_id, draft_task_id, schedule_id, publish_job_id, status,
        error_code, error_message, created_at, updated_at, finished_at
      FROM autopost_runs
      WHERE status IN ('queued', 'brief_generating', 'draft_generating')
        AND (brief_task_id = ? OR draft_task_id = ?)
      ORDER BY created_at DESC
      LIMIT 1`,
      [taskId, taskId],
    );

    return row ? mapRow(row) : null;
  }

  async listByAccountId(accountId: string, limit: number): Promise<AutopostRun[]> {
    const rows = this.db.all<Row>(
      `SELECT
        id, policy_id, workspace_id, account_id, generation_mode, source_scope, scheduled_for, trend_id,
        brief_id, brief_task_id, draft_id, draft_task_id, schedule_id, publish_job_id, status,
        error_code, error_message, created_at, updated_at, finished_at
      FROM autopost_runs
      WHERE account_id = ?
      ORDER BY created_at DESC
      LIMIT ?`,
      [accountId, limit],
    );

    return rows.map(mapRow);
  }

  async save(run: AutopostRun): Promise<void> {
    this.db.run(
      `INSERT INTO autopost_runs (
        id, policy_id, workspace_id, account_id, generation_mode, source_scope, scheduled_for, trend_id,
        brief_id, brief_task_id, draft_id, draft_task_id, schedule_id, publish_job_id, status,
        error_code, error_message, created_at, updated_at, finished_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        trend_id = excluded.trend_id,
        brief_id = excluded.brief_id,
        brief_task_id = excluded.brief_task_id,
        draft_id = excluded.draft_id,
        draft_task_id = excluded.draft_task_id,
        schedule_id = excluded.schedule_id,
        publish_job_id = excluded.publish_job_id,
        status = excluded.status,
        error_code = excluded.error_code,
        error_message = excluded.error_message,
        updated_at = excluded.updated_at,
        finished_at = excluded.finished_at`,
      [
        run.id,
        run.policy_id,
        run.workspace_id,
        run.account_id,
        run.generation_mode,
        run.source_scope,
        run.scheduled_for,
        run.trend_id ?? null,
        run.brief_id ?? null,
        run.brief_task_id ?? null,
        run.draft_id ?? null,
        run.draft_task_id ?? null,
        run.schedule_id ?? null,
        run.publish_job_id ?? null,
        run.status,
        run.error_code ?? null,
        run.error_message ?? null,
        run.created_at,
        run.updated_at,
        run.finished_at ?? null,
      ],
    );
  }
}

interface Row {
  id: string;
  policy_id: string;
  workspace_id: string;
  account_id: string;
  generation_mode: AutopostRun["generation_mode"];
  source_scope: string;
  scheduled_for: string;
  trend_id?: string | null;
  brief_id?: string | null;
  brief_task_id?: string | null;
  draft_id?: string | null;
  draft_task_id?: string | null;
  schedule_id?: string | null;
  publish_job_id?: string | null;
  status: AutopostRun["status"];
  error_code?: string | null;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
  finished_at?: string | null;
}

function mapRow(row: Row): AutopostRun {
  return {
    id: row.id,
    policy_id: row.policy_id,
    workspace_id: row.workspace_id,
    account_id: row.account_id,
    generation_mode: row.generation_mode,
    source_scope: row.source_scope,
    scheduled_for: row.scheduled_for,
    trend_id: row.trend_id ?? undefined,
    brief_id: row.brief_id ?? undefined,
    brief_task_id: row.brief_task_id ?? undefined,
    draft_id: row.draft_id ?? undefined,
    draft_task_id: row.draft_task_id ?? undefined,
    schedule_id: row.schedule_id ?? undefined,
    publish_job_id: row.publish_job_id ?? undefined,
    status: row.status,
    error_code: row.error_code ?? undefined,
    error_message: row.error_message ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
    finished_at: row.finished_at ?? undefined,
  };
}
