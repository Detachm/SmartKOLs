import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { AutopostRunNowResponse } from "../../../../contracts/api/autopost-policies";
import type { ExecuteAutopostPolicy } from "../../../../modules/autopost/application/commands/execute-autopost-policy";

export async function executeAutopostPolicyHandler(
  command: ExecuteAutopostPolicy,
  accountId: string,
): Promise<Result<AutopostRunNowResponse>> {
  try {
    return ok(await command.execute({
      account_id: accountId,
      trigger: "manual",
    }));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
