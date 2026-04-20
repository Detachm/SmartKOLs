import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { EngagementPolicyResponse, UpsertEngagementPolicyRequest } from "../../../../contracts/api/engagement-policies";
import type { UpsertEngagementPolicy } from "../../../../modules/engagement/application/commands/upsert-engagement-policy";

export async function upsertEngagementPolicyHandler(
  command: UpsertEngagementPolicy,
  accountId: string,
  input: UpsertEngagementPolicyRequest,
): Promise<Result<EngagementPolicyResponse>> {
  try {
    return ok({ policy: await command.execute({ account_id: accountId, ...input }) });
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
