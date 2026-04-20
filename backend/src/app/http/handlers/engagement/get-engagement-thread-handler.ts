import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { EngagementThreadDetailResponse } from "../../../../contracts/api/engagement";
import type { GetEngagementThread } from "../../../../modules/engagement/application/queries/get-engagement-thread";

export async function getEngagementThreadHandler(
  query: GetEngagementThread,
  threadId: string,
): Promise<Result<EngagementThreadDetailResponse>> {
  try {
    return ok(await query.execute(threadId));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
