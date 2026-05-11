import type { SqliteExecutor } from "../../../infrastructure/db/sqlite-executor";
import type { AlertChannelsRepository } from "../application/ports/alert-channels-repository";
import type { AlertChannel } from "../domain/alert-channel";

export class SqliteAlertChannelsRepository implements AlertChannelsRepository {
  constructor(private readonly db: SqliteExecutor) {}

  async findById(channelId: string): Promise<AlertChannel | null> {
    const row = this.db.get<{
      id: string;
      workspace_id: string;
      name: string;
      kind: AlertChannel["kind"];
      status: AlertChannel["status"];
      secret_ref: string;
      destination_hint: string;
      routing_body: string;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, workspace_id, name, kind, status, secret_ref, destination_hint, routing_body, created_at, updated_at
      FROM alert_channels
      WHERE id = ?`,
      [channelId],
    );

    if (!row) {
      return null;
    }

    return {
      ...row,
      routing_body: JSON.parse(row.routing_body) as AlertChannel["routing_body"],
    };
  }

  async listByWorkspaceId(workspaceId: string, limit: number): Promise<AlertChannel[]> {
    const rows = this.db.all<{
      id: string;
      workspace_id: string;
      name: string;
      kind: AlertChannel["kind"];
      status: AlertChannel["status"];
      secret_ref: string;
      destination_hint: string;
      routing_body: string;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, workspace_id, name, kind, status, secret_ref, destination_hint, routing_body, created_at, updated_at
      FROM alert_channels
      WHERE workspace_id = ?
      ORDER BY updated_at DESC
      LIMIT ?`,
      [workspaceId, limit],
    );

    return rows.map((row) => ({
      ...row,
      routing_body: JSON.parse(row.routing_body) as AlertChannel["routing_body"],
    }));
  }

  async save(channel: AlertChannel): Promise<void> {
    this.db.run(
      `INSERT INTO alert_channels (
        id, workspace_id, name, kind, status, secret_ref, destination_hint, routing_body, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        status = excluded.status,
        secret_ref = excluded.secret_ref,
        destination_hint = excluded.destination_hint,
        routing_body = excluded.routing_body,
        updated_at = excluded.updated_at`,
      [
        channel.id,
        channel.workspace_id,
        channel.name,
        channel.kind,
        channel.status,
        channel.secret_ref,
        channel.destination_hint,
        JSON.stringify(channel.routing_body),
        channel.created_at,
        channel.updated_at,
      ],
    );
  }

  async delete(channelId: string): Promise<void> {
    this.db.run(`DELETE FROM alert_channels WHERE id = ?`, [channelId]);
  }
}
