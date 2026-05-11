import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { UpsertAccountCredentialRequest, AccountCredentialResponse } from "../../../../contracts/api/account-credentials";
import type { UpsertAccountCredential } from "../../../../modules/connector-x/application/commands/upsert-account-credential";

export async function upsertAccountCredentialHandler(
  command: UpsertAccountCredential,
  accountId: string,
  input: UpsertAccountCredentialRequest,
): Promise<Result<AccountCredentialResponse>> {
  try {
    return ok(await command.execute(accountId, input));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
