import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { AccountGroupListResponse } from "../../../../contracts/api/account-groups";
import type { ListAccountGroups } from "../../../../modules/accounts/application/queries/list-account-groups";

export async function listAccountGroupsHandler(
  query: ListAccountGroups,
  input?: { workspace_id?: string },
): Promise<Result<AccountGroupListResponse>> {
  try {
    return ok(await query.execute(input));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
