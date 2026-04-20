import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { EngagementWorkbenchResponse } from "../../../../contracts/api/account-workbenches";
import type { GetEngagementWorkbench, GetEngagementWorkbenchInput } from "../../../../modules/engagement/application/queries/get-engagement-workbench";

export async function getEngagementWorkbenchHandler(
  query: GetEngagementWorkbench,
  input: GetEngagementWorkbenchInput,
): Promise<Result<EngagementWorkbenchResponse>> {
  try {
    return ok(await query.execute(input));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
