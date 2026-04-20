import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { AssignAccountsToGroupRequest, AssignAccountsToGroupResponse } from "../../../../contracts/api/account-groups";
import type { AssignAccountsToGroup } from "../../../../modules/accounts/application/commands/assign-accounts-to-group";

export async function assignAccountsToGroupHandler(
  command: AssignAccountsToGroup,
  input: AssignAccountsToGroupRequest,
): Promise<Result<AssignAccountsToGroupResponse>> {
  try {
    return ok(await command.execute(input));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
