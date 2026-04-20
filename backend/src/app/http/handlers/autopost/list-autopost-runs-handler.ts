import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { AutopostRunListResponse } from "../../../../contracts/api/autopost-policies";
import type { ListAutopostRuns } from "../../../../modules/autopost/application/queries/list-autopost-runs";

export async function listAutopostRunsHandler(
  query: ListAutopostRuns,
  accountId: string,
  limit?: number,
): Promise<Result<AutopostRunListResponse>> {
  try {
    return ok(await query.execute({ account_id: accountId, limit }));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
