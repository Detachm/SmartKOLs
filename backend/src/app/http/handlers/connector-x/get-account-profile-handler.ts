import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { SyncAccountProfileResponse } from "../../../../contracts/api/accounts";
import type { GetAccountProfile } from "../../../../modules/connector-x/application/commands/get-account-profile";

export async function getAccountProfileHandler(
  command: GetAccountProfile,
  accountId: string,
): Promise<Result<SyncAccountProfileResponse>> {
  try {
    return ok(await command.execute(accountId));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
