import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { GenerateDraftReviewResponse } from "../../../../contracts/api/drafts";
import type { GenerateDraftReview } from "../../../../modules/drafts/application/commands/generate-draft-review";

export async function generateDraftReviewHandler(
  command: GenerateDraftReview,
  draftId: string,
): Promise<Result<GenerateDraftReviewResponse>> {
  try {
    return ok(await command.execute(draftId));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
