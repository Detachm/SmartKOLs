import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { RecurringBriefPlanRunNowResponse } from "../../../../contracts/api/editorial";
import type { ExecuteRecurringBriefPlan } from "../../../../modules/editorial/application/commands/execute-recurring-brief-plan";

export async function executeRecurringBriefPlanHandler(
  command: ExecuteRecurringBriefPlan,
  planId: string,
): Promise<Result<RecurringBriefPlanRunNowResponse>> {
  try {
    return ok(await command.execute(planId));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
