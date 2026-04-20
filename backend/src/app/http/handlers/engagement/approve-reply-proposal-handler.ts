import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { ReplyProposalDetailResponse } from "../../../../contracts/api/engagement";
import type { ApproveReplyProposal } from "../../../../modules/engagement/application/commands/approve-reply-proposal";

export async function approveReplyProposalHandler(
  command: ApproveReplyProposal,
  proposalId: string,
): Promise<Result<ReplyProposalDetailResponse>> {
  try {
    return ok({ proposal: await command.execute(proposalId) });
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
