import { requireNonEmptyString, requireOneOf } from "../../../core/validation/guards";

export type NotificationType = "post" | "message" | "health" | "action" | "engagement";

export interface Notification {
  id: string;
  workspace_id: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  read_at?: string;
  created_at: string;
}

export function createNotification(notification: Notification): Notification {
  return {
    id: requireNonEmptyString(notification.id, "id"),
    workspace_id: requireNonEmptyString(notification.workspace_id, "workspace_id"),
    type: requireOneOf(notification.type, "type", ["post", "message", "health", "action", "engagement"] as const),
    title: requireNonEmptyString(notification.title, "title"),
    body: requireNonEmptyString(notification.body, "body"),
    link: notification.link?.trim() || undefined,
    read_at: notification.read_at?.trim() || undefined,
    created_at: requireNonEmptyString(notification.created_at, "created_at"),
  };
}
