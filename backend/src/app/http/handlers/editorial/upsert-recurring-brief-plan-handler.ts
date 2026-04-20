import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { RecurringBriefPlanResponse, UpsertRecurringBriefPlanRequest } from "../../../../contracts/api/editorial";
import type { UpsertRecurringBriefPlan } from "../../../../modules/editorial/application/commands/upsert-recurring-brief-plan";

export async function upsertRecurringBriefPlanHandler(
  command: UpsertRecurringBriefPlan,
  accountId: string,
  input: UpsertRecurringBriefPlanRequest,
  planId?: string,
): Promise<Result<RecurringBriefPlanResponse>> {
  try {
    return ok(await command.execute({
      plan_id: planId,
      account_id: accountId,
      ...input,
    }));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
