import type { SqliteExecutor, SqliteStatementExecutor } from "../../../infrastructure/db/sqlite-executor";
import type { WorkerJobsRepository } from "../application/ports/worker-jobs-repository";
import type { WorkerJob, WorkerJobType } from "../domain/worker-job";

export class SqliteWorkerJobsRepository implements WorkerJobsRepository {
  constructor(private readonly db: SqliteStatementExecutor) {}

  async findById(jobId: string): Promise<WorkerJob | null> {
    return this.db.get<WorkerJob>(
      `SELECT
        id, workspace_id, job_type, target_type, target_id, payload, status, run_after, lease_expires_at,
        error_code, error_message, started_at, finished_at, created_at
      FROM worker_jobs
      WHERE id = ?`,
      [jobId],
    );
  }

  async findQueuedByTypeAndTarget(jobType: WorkerJobType, targetType: string, targetId: string): Promise<WorkerJob | null> {
    return this.db.get<WorkerJob>(
      `SELECT
        id, workspace_id, job_type, target_type, target_id, payload, status, run_after, lease_expires_at,
        error_code, error_message, started_at, finished_at, created_at
      FROM worker_jobs
      WHERE status = 'queued' AND job_type = ? AND target_type = ? AND target_id = ?
      ORDER BY run_after ASC, created_at ASC
      LIMIT 1`,
      [jobType, targetType, targetId],
    );
  }

  async findLatestByTypeAndTarget(jobType: WorkerJobType, targetType: string, targetId: string): Promise<WorkerJob | null> {
    return this.db.get<WorkerJob>(
      `SELECT
        id, workspace_id, job_type, target_type, target_id, payload, status, run_after, lease_expires_at,
        error_code, error_message, started_at, finished_at, created_at
      FROM worker_jobs
      WHERE job_type = ? AND target_type = ? AND target_id = ?
      ORDER BY COALESCE(finished_at, started_at, run_after, created_at) DESC, created_at DESC, id DESC
      LIMIT 1`,
      [jobType, targetType, targetId],
    );
  }

  async listByWorkspaceAndStatus(workspaceId: string, status: WorkerJob["status"], limit: number): Promise<WorkerJob[]> {
    return this.db.all<WorkerJob>(
      `SELECT
        id, workspace_id, job_type, target_type, target_id, payload, status, run_after, lease_expires_at,
        error_code, error_message, started_at, finished_at, created_at
      FROM worker_jobs
      WHERE workspace_id = ? AND status = ?
      ORDER BY COALESCE(finished_at, started_at, run_after, created_at) ASC, id ASC
      LIMIT ?`,
      [workspaceId, status, limit],
    );
  }

  async create(job: WorkerJob): Promise<void> {
    this.db.run(
      `INSERT INTO worker_jobs (
        id, workspace_id, job_type, target_type, target_id, payload, status, run_after, lease_expires_at,
        error_code, error_message, started_at, finished_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        job.id,
        job.workspace_id,
        job.job_type,
        job.target_type,
        job.target_id,
        job.payload,
        job.status,
        job.run_after,
        job.lease_expires_at ?? null,
        job.error_code ?? null,
        job.error_message ?? null,
        job.started_at ?? null,
        job.finished_at ?? null,
        job.created_at,
      ],
    );
  }

  async save(job: WorkerJob): Promise<void> {
    this.db.run(
      `UPDATE worker_jobs
      SET status = ?, run_after = ?, lease_expires_at = ?, error_code = ?, error_message = ?, started_at = ?, finished_at = ?
      WHERE id = ?`,
      [
        job.status,
        job.run_after,
        job.lease_expires_at ?? null,
        job.error_code ?? null,
        job.error_message ?? null,
        job.started_at ?? null,
        job.finished_at ?? null,
        job.id,
      ],
    );
  }

  async cancelQueuedByTypeAndTarget(jobType: WorkerJobType, targetType: string, targetId: string): Promise<void> {
    this.db.run(
      `UPDATE worker_jobs
      SET status = 'cancelled', finished_at = COALESCE(finished_at, CURRENT_TIMESTAMP)
      WHERE status = 'queued' AND job_type = ? AND target_type = ? AND target_id = ?`,
      [jobType, targetType, targetId],
    );
  }

  async claimNextReady(jobTypes: WorkerJobType[], now: string, startedAt: string, leaseExpiresAt: string): Promise<WorkerJob | null> {
    return requireTransactionalExecutor(this.db).transaction((tx) => {
      const placeholders = jobTypes.map(() => "?").join(", ");
      const job = tx.get<WorkerJob>(
        `SELECT
          id, workspace_id, job_type, target_type, target_id, payload, status, run_after, lease_expires_at,
          error_code, error_message, started_at, finished_at, created_at
        FROM worker_jobs
        WHERE status = 'queued' AND run_after <= ? AND job_type IN (${placeholders})
        ORDER BY run_after ASC, created_at ASC
        LIMIT 1`,
        [now, ...jobTypes],
      );

      if (!job) {
        return null;
      }

      const claimed = tx.run(
        `UPDATE worker_jobs
        SET status = 'running', started_at = ?, lease_expires_at = ?, error_code = NULL, error_message = NULL, finished_at = NULL
        WHERE id = ? AND status = 'queued'`,
        [startedAt, leaseExpiresAt, job.id],
      );

      if (claimed.changes !== 1) {
        return null;
      }

      return {
        ...job,
        status: "running" as const,
        started_at: startedAt,
        lease_expires_at: leaseExpiresAt,
        error_code: undefined,
        error_message: undefined,
        finished_at: undefined,
      };
    });
  }

  async listExpiredRunning(now: string, limit: number, jobTypes?: WorkerJobType[]): Promise<WorkerJob[]> {
    if (!jobTypes || jobTypes.length === 0) {
      return this.db.all<WorkerJob>(
        `SELECT
          id, workspace_id, job_type, target_type, target_id, payload, status, run_after, lease_expires_at,
          error_code, error_message, started_at, finished_at, created_at
        FROM worker_jobs
        WHERE status = 'running' AND lease_expires_at IS NOT NULL AND lease_expires_at <= ?
        ORDER BY lease_expires_at ASC
        LIMIT ?`,
        [now, limit],
      );
    }

    const placeholders = jobTypes.map(() => "?").join(", ");
    return this.db.all<WorkerJob>(
      `SELECT
        id, workspace_id, job_type, target_type, target_id, payload, status, run_after, lease_expires_at,
        error_code, error_message, started_at, finished_at, created_at
      FROM worker_jobs
      WHERE status = 'running' AND lease_expires_at IS NOT NULL AND lease_expires_at <= ? AND job_type IN (${placeholders})
      ORDER BY lease_expires_at ASC
      LIMIT ?`,
      [now, ...jobTypes, limit],
    );
  }
}

function requireTransactionalExecutor(db: SqliteStatementExecutor): SqliteExecutor {
  if ("transaction" in db && typeof (db as SqliteExecutor).transaction === "function") {
    return db as SqliteExecutor;
  }

  throw new Error("transactional sqlite executor is required for queue claim operations");
}
