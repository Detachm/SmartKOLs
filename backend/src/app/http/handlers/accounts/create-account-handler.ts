import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { CreateAccountRequest, AccountResponse } from "../../../../contracts/api/accounts";
import type { CreateAccount } from "../../../../modules/accounts/application/commands/create-account";

export async function createAccountHandler(
  command: CreateAccount,
  input: CreateAccountRequest,
): Promise<Result<AccountResponse>> {
  try {
    return ok(await command.execute(input));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
