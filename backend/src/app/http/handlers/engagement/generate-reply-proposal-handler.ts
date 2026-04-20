import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { GenerateReplyProposalResponse } from "../../../../contracts/api/engagement";
import type { GenerateReplyProposal } from "../../../../modules/engagement/application/commands/generate-reply-proposal";

export async function generateReplyProposalHandler(
  command: GenerateReplyProposal,
  threadId: string,
): Promise<Result<GenerateReplyProposalResponse>> {
  try {
    return ok(await command.execute(threadId));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
