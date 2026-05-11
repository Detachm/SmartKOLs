import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { DraftReviewListResponse } from "../../../../contracts/api/draft-reviews";
import type { ListDraftReviews } from "../../../../modules/drafts/application/queries/list-draft-reviews";

export async function listDraftReviewsHandler(
  query: ListDraftReviews,
  draftId: string,
): Promise<Result<DraftReviewListResponse>> {
  try {
    return ok(await query.execute(draftId));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
