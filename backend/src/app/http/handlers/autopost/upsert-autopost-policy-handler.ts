import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { AutopostPolicyResponse, UpsertAutopostPolicyRequest } from "../../../../contracts/api/autopost-policies";
import type { UpsertAutopostPolicy } from "../../../../modules/autopost/application/commands/upsert-autopost-policy";

export async function upsertAutopostPolicyHandler(
  command: UpsertAutopostPolicy,
  accountId: string,
  input: UpsertAutopostPolicyRequest,
): Promise<Result<AutopostPolicyResponse>> {
  try {
    return ok({ policy: await command.execute({ account_id: accountId, ...input }) });
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
