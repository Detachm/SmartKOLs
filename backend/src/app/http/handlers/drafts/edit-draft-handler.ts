import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { EditDraft, EditDraftRequest } from "../../../../modules/drafts/application/commands/edit-draft";
import type { DraftResponse } from "../../../../contracts/api/drafts";

export async function editDraftHandler(
  command: EditDraft,
  draftId: string,
  input: EditDraftRequest,
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
