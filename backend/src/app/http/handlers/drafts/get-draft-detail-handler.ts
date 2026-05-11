import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { DraftDetailResponse } from "../../../../contracts/api/drafts";
import type { GetDraftDetail } from "../../../../modules/drafts/application/queries/get-draft-detail";

export async function getDraftDetailHandler(
  query: GetDraftDetail,
  draftId: string,
): Promise<Result<DraftDetailResponse>> {
  try {
    return ok(await query.execute(draftId));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
