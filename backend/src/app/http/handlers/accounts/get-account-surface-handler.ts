import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { AccountSurfaceResponse } from "../../../../contracts/api/account-surface";
import type { GetAccountSurface } from "../../../../modules/accounts/application/queries/get-account-surface";

export async function getAccountSurfaceHandler(
  query: GetAccountSurface,
  accountId: string,
): Promise<Result<AccountSurfaceResponse>> {
  try {
    return ok(await query.execute(accountId));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
