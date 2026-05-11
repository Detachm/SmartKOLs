import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { EngagementThreadListResponse } from "../../../../contracts/api/engagement";
import type {
  ListAccountEngagementThreads,
  ListAccountEngagementThreadsInput,
} from "../../../../modules/engagement/application/queries/list-account-engagement-threads";

export async function listAccountEngagementThreadsHandler(
  query: ListAccountEngagementThreads,
  input: ListAccountEngagementThreadsInput,
): Promise<Result<EngagementThreadListResponse>> {
  try {
    return ok(await query.execute(input));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
