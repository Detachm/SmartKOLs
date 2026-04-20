import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { AccountListResponse } from "../../../../contracts/api/accounts";
import type { ListAccounts } from "../../../../modules/accounts/application/queries/list-accounts";

export async function listAccountsHandler(
  query: ListAccounts,
  input?: { workspace_id?: string },
): Promise<Result<AccountListResponse>> {
  try {
    return ok(await query.execute(input));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
