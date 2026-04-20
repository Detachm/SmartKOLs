import type { SqliteExecutor } from "../../../infrastructure/db/sqlite-executor";
import type { NotificationsRepository } from "../application/ports/notifications-repository";
import type { Notification } from "../domain/notification";

export class SqliteNotificationsRepository implements NotificationsRepository {
  constructor(private readonly db: SqliteExecutor) {}

  async create(notification: Notification): Promise<void> {
    this.db.run(
      `INSERT INTO notifications (
        id, workspace_id, type, title, body, link, read_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        notification.id,
        notification.workspace_id,
        notification.type,
        notification.title,
        notification.body,
        notification.link ?? null,
        notification.read_at ?? null,
        notification.created_at,
      ],
    );
  }

  async listByWorkspaceId(workspaceId: string, limit: number): Promise<Notification[]> {
    return this.db.all<Notification>(
      `SELECT id, workspace_id, type, title, body, link, read_at, created_at
      FROM notifications
      WHERE workspace_id = ?
      ORDER BY created_at DESC
      LIMIT ?`,
      [workspaceId, limit],
    );
  }
}
