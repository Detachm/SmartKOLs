import type { Notification } from "../../domain/notification";

export interface NotificationsRepository {
  create(notification: Notification): Promise<void>;
  listByWorkspaceId(workspaceId: string, limit: number): Promise<Notification[]>;
}
