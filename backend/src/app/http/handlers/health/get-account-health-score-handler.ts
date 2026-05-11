import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { HealthScoreResponse } from "../../../../contracts/api/health";
import type { GetAccountHealthScore } from "../../../../modules/health/application/queries/get-account-health-score";

export async function getAccountHealthScoreHandler(
  query: GetAccountHealthScore,
  accountId: string,
): Promise<Result<HealthScoreResponse>> {
  try {
    return ok(await query.execute(accountId));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
