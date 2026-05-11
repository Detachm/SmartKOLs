import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { AccountCredentialResponse } from "../../../../contracts/api/account-credentials";
import type { ValidateAccountCredential } from "../../../../modules/connector-x/application/commands/validate-account-credential";

export async function validateAccountCredentialHandler(
  command: ValidateAccountCredential,
  accountId: string,
): Promise<Result<AccountCredentialResponse>> {
  try {
    return ok(await command.execute(accountId));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
