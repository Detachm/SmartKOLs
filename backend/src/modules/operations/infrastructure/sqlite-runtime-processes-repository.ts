import type { SqliteExecutor } from "../../../infrastructure/db/sqlite-executor";
import type { RuntimeProcessesRepository } from "../application/ports/runtime-processes-repository";
import type { RuntimeProcess } from "../domain/runtime-process";

export class SqliteRuntimeProcessesRepository implements RuntimeProcessesRepository {
  constructor(private readonly db: SqliteExecutor) {}

  async upsertHeartbeat(process: RuntimeProcess): Promise<void> {
    this.db.run(
      `INSERT INTO runtime_processes (
        id, process_type, process_name, pid, hostname, status, metadata_json, started_at, last_heartbeat_at, stopped_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        process_type = excluded.process_type,
        process_name = excluded.process_name,
        pid = excluded.pid,
        hostname = excluded.hostname,
        status = excluded.status,
        metadata_json = excluded.metadata_json,
        started_at = excluded.started_at,
        last_heartbeat_at = excluded.last_heartbeat_at,
        stopped_at = excluded.stopped_at`,
      [
        process.id,
        process.process_type,
        process.process_name,
        process.pid,
        process.hostname,
        process.status,
        process.metadata_json,
        process.started_at,
        process.last_heartbeat_at,
        process.stopped_at ?? null,
      ],
    );
  }

  async markStopped(input: { process_id: string; stopped_at: string }): Promise<void> {
    this.db.run(
      `UPDATE runtime_processes
      SET status = 'stopped',
          last_heartbeat_at = ?,
          stopped_at = ?
      WHERE id = ?`,
      [input.stopped_at, input.stopped_at, input.process_id],
    );
  }

  async cleanupStaleRunningProcesses(input: {
    stale_before: string;
    stopped_at: string;
    limit: number;
  }): Promise<{
    matched_count: number;
    updated_count: number;
    process_ids: string[];
  }> {
    const rows = this.db.all<{ id: string }>(
      `SELECT id
      FROM runtime_processes
      WHERE status = 'running'
        AND last_heartbeat_at < ?
      ORDER BY last_heartbeat_at ASC
      LIMIT ?`,
      [input.stale_before, input.limit],
    );

    if (rows.length === 0) {
      return {
        matched_count: 0,
        updated_count: 0,
        process_ids: [],
      };
    }

    const ids = rows.map((row) => row.id);
    const placeholders = ids.map(() => "?").join(", ");
    const result = this.db.run(
      `UPDATE runtime_processes
      SET status = 'stopped',
          last_heartbeat_at = ?,
          stopped_at = ?
      WHERE status = 'running'
        AND id IN (${placeholders})`,
      [input.stopped_at, input.stopped_at, ...ids],
    );

    return {
      matched_count: ids.length,
      updated_count: result.changes,
      process_ids: ids,
    };
  }
}
