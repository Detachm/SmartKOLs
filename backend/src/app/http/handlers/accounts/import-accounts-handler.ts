import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { ImportAccountsRequest, ImportAccountsResponse } from "../../../../contracts/api/account-imports";
import type { ImportAccounts } from "../../../../modules/accounts/application/commands/import-accounts";

export async function importAccountsHandler(
  command: ImportAccounts,
  input: ImportAccountsRequest,
): Promise<Result<ImportAccountsResponse>> {
  try {
    return ok(await command.execute(input));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
