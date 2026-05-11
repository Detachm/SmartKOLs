import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { ReplyProposalListResponse } from "../../../../contracts/api/engagement";
import type { ListThreadReplyProposals } from "../../../../modules/engagement/application/queries/list-thread-reply-proposals";

export async function listThreadReplyProposalsHandler(
  query: ListThreadReplyProposals,
  threadId: string,
): Promise<Result<ReplyProposalListResponse>> {
  try {
    return ok(await query.execute(threadId));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
