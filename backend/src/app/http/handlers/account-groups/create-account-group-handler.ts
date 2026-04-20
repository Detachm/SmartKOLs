import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { AccountGroupResponse, CreateAccountGroupRequest } from "../../../../contracts/api/account-groups";
import type { CreateAccountGroup } from "../../../../modules/accounts/application/commands/create-account-group";

export async function createAccountGroupHandler(
  command: CreateAccountGroup,
  input: CreateAccountGroupRequest,
): Promise<Result<AccountGroupResponse>> {
  try {
    return ok(await command.execute(input));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
