import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { DeleteAccountResponse } from "../../../../contracts/api/accounts";
import type { DeleteAccount } from "../../../../modules/accounts/application/commands/delete-account";

export async function deleteAccountHandler(
  command: DeleteAccount,
  accountId: string,
): Promise<Result<DeleteAccountResponse>> {
  try {
    return ok(await command.execute(accountId));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
