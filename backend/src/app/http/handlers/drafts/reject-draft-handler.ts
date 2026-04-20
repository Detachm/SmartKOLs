import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { RejectDraft, RejectDraftRequest } from "../../../../modules/drafts/application/commands/reject-draft";
import type { DraftResponse } from "../../../../contracts/api/drafts";

export async function rejectDraftHandler(
  command: RejectDraft,
  draftId: string,
  input: RejectDraftRequest,
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
