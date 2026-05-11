import type { Notification } from "../../modules/notifications/domain/notification";

export interface NotificationListResponse {
  notifications: Notification[];
}
