import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { ApproveDraft } from "../../../../modules/drafts/application/commands/approve-draft";
import type { ApproveDraftRequest, DraftResponse } from "../../../../contracts/api/drafts";

export async function approveDraftHandler(
  command: ApproveDraft,
  draftId: string,
  input: ApproveDraftRequest,
): Promise<Result<DraftResponse>> {
  try {
    return ok(await command.execute(draftId, input));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
