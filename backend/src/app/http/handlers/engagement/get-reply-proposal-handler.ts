import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { ReplyProposalDetailResponse } from "../../../../contracts/api/engagement";
import type { GetReplyProposal } from "../../../../modules/engagement/application/queries/get-reply-proposal";

export async function getReplyProposalHandler(
  query: GetReplyProposal,
  proposalId: string,
): Promise<Result<ReplyProposalDetailResponse>> {
  try {
    return ok(await query.execute(proposalId));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
