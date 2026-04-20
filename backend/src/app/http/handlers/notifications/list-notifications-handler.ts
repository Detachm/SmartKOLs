import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { NotificationListResponse } from "../../../../contracts/api/notifications";
import type { ListNotifications } from "../../../../modules/notifications/application/queries/list-notifications";

export async function listNotificationsHandler(
  query: ListNotifications,
  workspaceId: string,
  limit: number,
): Promise<Result<NotificationListResponse>> {
  try {
    return ok(await query.execute(workspaceId, limit));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
