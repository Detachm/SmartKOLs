import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { HealthFactorsResponse } from "../../../../contracts/api/health-factors";
import type { ComputeAccountHealthScore } from "../../../../modules/health/application/commands/compute-account-health-score";

export async function computeAccountHealthScoreHandler(
  command: ComputeAccountHealthScore,
  accountId: string,
): Promise<Result<HealthFactorsResponse>> {
  try {
    return ok(await command.execute(accountId));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
