import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { AccountReadinessResponse } from "../../../../contracts/api/account-readiness";
import type { GetAccountReadiness } from "../../../../modules/accounts/application/queries/get-account-readiness";

export async function getAccountReadinessHandler(
  query: GetAccountReadiness,
  accountId: string,
): Promise<Result<AccountReadinessResponse>> {
  try {
    return ok(await query.execute(accountId));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
