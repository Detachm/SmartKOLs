import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { EngagementPolicyResponse } from "../../../../contracts/api/engagement-policies";
import type { GetEngagementPolicy } from "../../../../modules/engagement/application/queries/get-engagement-policy";

export async function getEngagementPolicyHandler(
  query: GetEngagementPolicy,
  accountId: string,
): Promise<Result<EngagementPolicyResponse>> {
  try {
    return ok(await query.execute(accountId));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
