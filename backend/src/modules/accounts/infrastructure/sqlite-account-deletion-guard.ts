import type { SqliteExecutor } from "../../../infrastructure/db/sqlite-executor";
import type { AccountDeleteSafetyCheck, AccountDeletionGuard } from "../application/ports/account-deletion-guard";

interface DeleteSafetyRow {
  active_agent_tasks: number;
  active_worker_jobs: number;
  active_publish_jobs: number;
  active_source_fetch_runs: number;
}

export class SqliteAccountDeletionGuard implements AccountDeletionGuard {
  constructor(private readonly db: SqliteExecutor) {}

  async getDeleteSafety(accountId: string): Promise<AccountDeleteSafetyCheck> {
    const row = this.db.get<DeleteSafetyRow>(
      `SELECT
        (
          SELECT COUNT(*)
          FROM agent_tasks AS task
          WHERE task.status IN ('queued', 'running')
            AND (
              (task.target_type = 'account' AND task.target_id = ?)
              OR (task.target_type = 'draft' AND task.target_id IN (
                SELECT id FROM drafts WHERE account_id = ?
              ))
              OR (task.target_type = 'engagement_thread' AND task.target_id IN (
                SELECT id FROM engagement_threads WHERE account_id = ?
              ))
            )
        ) AS active_agent_tasks,
        (
          SELECT COUNT(*)
          FROM worker_jobs AS job
          WHERE job.status IN ('queued', 'running')
            AND (
              (job.target_type = 'account' AND job.target_id = ?)
              OR (job.target_type = 'reply_proposal' AND job.target_id IN (
                SELECT id FROM engagement_reply_proposals WHERE account_id = ?
              ))
            )
        ) AS active_worker_jobs,
        (
          SELECT COUNT(*)
          FROM publish_jobs AS job
          INNER JOIN publish_schedules AS schedule ON schedule.id = job.schedule_id
          WHERE schedule.account_id = ?
            AND job.status IN ('queued', 'running')
        ) AS active_publish_jobs,
        (
          SELECT COUNT(*)
          FROM source_fetch_runs AS run
          INNER JOIN sources AS source ON source.id = run.source_id
          WHERE source.account_id = ?
            AND run.status IN ('queued', 'running')
        ) AS active_source_fetch_runs`,
      [
        accountId,
        accountId,
        accountId,
        accountId,
        accountId,
        accountId,
        accountId,
      ],
    );

    return {
      active_agent_tasks: row?.active_agent_tasks ?? 0,
      active_worker_jobs: row?.active_worker_jobs ?? 0,
      active_publish_jobs: row?.active_publish_jobs ?? 0,
      active_source_fetch_runs: row?.active_source_fetch_runs ?? 0,
    };
  }
}
