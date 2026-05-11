import type { NotificationsRepository } from "../ports/notifications-repository";

export interface ListNotificationsDependencies {
  notifications: NotificationsRepository;
}

export class ListNotifications {
  constructor(private readonly deps: ListNotificationsDependencies) {}

  async execute(workspaceId: string, limit: number) {
    return {
      notifications: await this.deps.notifications.listByWorkspaceId(workspaceId, limit),
    };
  }
}
