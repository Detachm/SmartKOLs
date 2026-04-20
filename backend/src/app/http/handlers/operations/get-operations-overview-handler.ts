import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { OperationsOverviewResponse } from "../../../../contracts/api/operations";
import type { GetOperationsOverview } from "../../../../modules/operations/application/queries/get-operations-overview";

export async function getOperationsOverviewHandler(
  query: GetOperationsOverview,
  limit?: number,
): Promise<Result<OperationsOverviewResponse>> {
  try {
    return ok(await query.execute(limit));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
