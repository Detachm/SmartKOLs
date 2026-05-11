import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { RecurringBriefPlanListResponse } from "../../../../contracts/api/editorial";
import type { ListRecurringBriefPlans } from "../../../../modules/editorial/application/queries/list-recurring-brief-plans";

export async function listRecurringBriefPlansHandler(
  query: ListRecurringBriefPlans,
  accountId: string,
): Promise<Result<RecurringBriefPlanListResponse>> {
  try {
    return ok(await query.execute(accountId));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
