import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { AutopostPolicyResponse } from "../../../../contracts/api/autopost-policies";
import type { GetAutopostPolicy } from "../../../../modules/autopost/application/queries/get-autopost-policy";

export async function getAutopostPolicyHandler(
  query: GetAutopostPolicy,
  accountId: string,
): Promise<Result<AutopostPolicyResponse>> {
  try {
    return ok(await query.execute(accountId));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
