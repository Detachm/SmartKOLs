import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { HealthFactorsResponse } from "../../../../contracts/api/health-factors";
import type { GetAccountHealthFactors } from "../../../../modules/health/application/queries/get-account-health-factors";

export async function getAccountHealthFactorsHandler(
  query: GetAccountHealthFactors,
  accountId: string,
): Promise<Result<HealthFactorsResponse>> {
  try {
    return ok(await query.execute(accountId));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
