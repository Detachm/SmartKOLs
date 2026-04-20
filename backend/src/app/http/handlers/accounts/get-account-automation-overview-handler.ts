import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { AccountAutomationOverviewResponse } from "../../../../contracts/api/account-automation";
import type { GetAccountAutomationOverview } from "../../../../modules/orchestration/application/queries/get-account-automation-overview";

export async function getAccountAutomationOverviewHandler(
  query: GetAccountAutomationOverview,
  accountId: string,
): Promise<Result<AccountAutomationOverviewResponse>> {
  try {
    const overview = await query.execute(accountId);
    if (!overview) {
      return err(new AppError("NOT_FOUND", "account automation overview not found", {
        details: { account_id: accountId },
      }));
    }

    return ok(overview);
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
