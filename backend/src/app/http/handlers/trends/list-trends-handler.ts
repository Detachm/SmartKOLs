import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { TrendListResponse } from "../../../../contracts/api/trends";
import type { ListTrends } from "../../../../modules/trends/application/queries/list-trends";

export async function listTrendsHandler(
  query: ListTrends,
  workspaceId: string,
): Promise<Result<TrendListResponse>> {
  try {
    return ok(await query.execute(workspaceId));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
