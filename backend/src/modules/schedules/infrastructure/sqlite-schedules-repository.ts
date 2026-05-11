import type { SqliteExecutor, SqliteStatementExecutor } from "../../../infrastructure/db/sqlite-executor";
import type { SchedulesRepository } from "../application/ports/schedules-repository";
import type { PublishSchedule } from "../domain/publish-schedule";
import type { PublishJob } from "../domain/publish-job";

export class SqliteSchedulesRepository implements SchedulesRepository {
  constructor(private readonly db: SqliteStatementExecutor) {}

  async findScheduleById(scheduleId: string): Promise<PublishSchedule | null> {
    return this.db.get<PublishSchedule>(
      `SELECT id, workspace_id, account_id, draft_id, scheduled_for, status, created_at
      FROM publish_schedules
      WHERE id = ?`,
      [scheduleId],
    );
  }

  async listDueScheduledSchedules(now: string, limit: number): Promise<PublishSchedule[]> {
    return this.db.all<PublishSchedule>(
      `SELECT ps.id, ps.workspace_id, ps.account_id, ps.draft_id, ps.scheduled_for, ps.status, ps.created_at
      FROM publish_schedules ps
      WHERE ps.status = 'scheduled'
        AND ps.scheduled_for <= ?
        AND NOT EXISTS (
          SELECT 1
          FROM publish_jobs pj
          WHERE pj.schedule_id = ps.id
            AND pj.status IN ('queued', 'running', 'succeeded')
        )
      ORDER BY ps.scheduled_for ASC, ps.id ASC
      LIMIT ?`,
      [now, limit],
    );
  }

  async createSchedule(schedule: PublishSchedule): Promise<void> {
    this.createScheduleSync(schedule);
  }

  createScheduleSync(schedule: PublishSchedule): void {
    this.db.run(
      `INSERT INTO publish_schedules (
        id, workspace_id, account_id, draft_id, scheduled_for, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        schedule.id,
        schedule.workspace_id,
        schedule.account_id,
        schedule.draft_id,
        schedule.scheduled_for,
        schedule.status,
        schedule.created_at,
      ],
    );
  }

  async saveSchedule(schedule: PublishSchedule): Promise<void> {
    this.saveScheduleSync(schedule);
  }

  saveScheduleSync(schedule: PublishSchedule): void {
    this.db.run(
      `UPDATE publish_schedules
      SET status = ?, scheduled_for = ?
      WHERE id = ?`,
      [schedule.status, schedule.scheduled_for, schedule.id],
    );
  }

  async createPublishJob(job: PublishJob): Promise<void> {
    this.createPublishJobSync(job);
  }

  createPublishJobSync(job: PublishJob): void {
    this.db.run(
      `INSERT INTO publish_jobs (
        id, schedule_id, status, idempotency_key, error_code, error_message, run_after, started_at, lease_expires_at, finished_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        job.id,
        job.schedule_id,
        job.status,
        job.idempotency_key,
        job.error_code ?? null,
        job.error_message ?? null,
        job.run_after,
        job.started_at ?? null,
        job.lease_expires_at ?? null,
        job.finished_at ?? null,
      ],
    );
  }

  async findPublishJobById(publishJobId: string): Promise<PublishJob | null> {
    return this.db.get<PublishJob>(
      `SELECT id, schedule_id, status, idempotency_key, error_code, error_message, run_after, started_at, lease_expires_at, finished_at
      FROM publish_jobs
      WHERE id = ?`,
      [publishJobId],
    );
  }

  async findLatestPublishJobByScheduleId(scheduleId: string): Promise<PublishJob | null> {
    return this.db.get<PublishJob>(
      `SELECT id, schedule_id, status, idempotency_key, error_code, error_message, run_after, started_at, lease_expires_at, finished_at
      FROM publish_jobs
      WHERE schedule_id = ?
      ORDER BY COALESCE(finished_at, started_at, run_after) DESC, id DESC
      LIMIT 1`,
      [scheduleId],
    );
  }

  async listPublishJobsByWorkspaceAndStatus(workspaceId: string, status: PublishJob["status"], limit: number): Promise<PublishJob[]> {
    return this.db.all<PublishJob>(
      `SELECT
        pj.id, pj.schedule_id, pj.status, pj.idempotency_key, pj.error_code, pj.error_message, pj.run_after, pj.started_at, pj.lease_expires_at, pj.finished_at
      FROM publish_jobs pj
      INNER JOIN publish_schedules ps ON ps.id = pj.schedule_id
      WHERE ps.workspace_id = ? AND pj.status = ?
      ORDER BY COALESCE(pj.finished_at, pj.started_at, pj.run_after) ASC, pj.id ASC
      LIMIT ?`,
      [workspaceId, status, limit],
    );
  }

  async claimNextReadyPublishJob(now: string, startedAt: string, leaseExpiresAt: string): Promise<PublishJob | null> {
    return requireTransactionalExecutor(this.db).transaction((tx) => {
      const job = tx.get<PublishJob>(
        `SELECT id, schedule_id, status, idempotency_key, error_code, error_message, run_after, started_at, lease_expires_at, finished_at
        FROM publish_jobs
        WHERE status = 'queued' AND run_after <= ?
        ORDER BY run_after ASC, id ASC
        LIMIT 1`,
        [now],
      );

      if (!job) {
        return null;
      }

      const claimed = tx.run(
        `UPDATE publish_jobs
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

  async listExpiredRunningPublishJobs(now: string, limit: number): Promise<PublishJob[]> {
    return this.db.all<PublishJob>(
      `SELECT id, schedule_id, status, idempotency_key, error_code, error_message, run_after, started_at, lease_expires_at, finished_at
      FROM publish_jobs
      WHERE status = 'running' AND lease_expires_at IS NOT NULL AND lease_expires_at <= ?
      ORDER BY lease_expires_at ASC
      LIMIT ?`,
      [now, limit],
    );
  }

  async savePublishJob(job: PublishJob): Promise<void> {
    this.savePublishJobSync(job);
  }

  savePublishJobSync(job: PublishJob): void {
    this.db.run(
      `UPDATE publish_jobs
      SET status = ?, error_code = ?, error_message = ?, run_after = ?, started_at = ?, lease_expires_at = ?, finished_at = ?
      WHERE id = ?`,
      [
        job.status,
        job.error_code ?? null,
        job.error_message ?? null,
        job.run_after,
        job.started_at ?? null,
        job.lease_expires_at ?? null,
        job.finished_at ?? null,
        job.id,
      ],
    );
  }
}

function requireTransactionalExecutor(
  db: SqliteStatementExecutor,
): SqliteExecutor {
  if (isTransactionalExecutor(db)) {
    return db;
  }

  throw new Error("transactional sqlite executor is required for queue claim operations");
}

function isTransactionalExecutor(db: SqliteStatementExecutor): db is SqliteExecutor {
  return "transaction" in db && typeof (db as SqliteExecutor).transaction === "function";
}
