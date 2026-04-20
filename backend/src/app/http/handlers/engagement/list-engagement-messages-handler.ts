import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { MessageListResponse } from "../../../../contracts/api/messages";
import type { ListEngagementMessages } from "../../../../modules/engagement/application/queries/list-engagement-messages";

export async function listEngagementMessagesHandler(
  query: ListEngagementMessages,
  threadId: string,
): Promise<Result<MessageListResponse>> {
  try {
    return ok(await query.execute(threadId));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
