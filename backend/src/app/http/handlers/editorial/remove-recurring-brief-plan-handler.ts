import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { RemoveRecurringBriefPlan } from "../../../../modules/editorial/application/commands/remove-recurring-brief-plan";

export async function removeRecurringBriefPlanHandler(
  command: RemoveRecurringBriefPlan,
  planId: string,
): Promise<Result<{ deleted: true }>> {
  try {
    await command.execute(planId);
    return ok({ deleted: true as const });
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
