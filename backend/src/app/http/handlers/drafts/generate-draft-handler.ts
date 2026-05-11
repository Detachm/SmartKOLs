import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { GenerateDraftRequest, GenerateDraftResponse } from "../../../../contracts/api/drafts";
import type { GenerateDraft } from "../../../../modules/drafts/application/commands/generate-draft";

export async function generateDraftHandler(
  command: GenerateDraft,
  accountId: string,
  input: GenerateDraftRequest,
): Promise<Result<GenerateDraftResponse>> {
  try {
    return ok(await command.execute({
      account_id: accountId,
      topic: input.topic,
      trend_id: input.trend_id,
      content_brief_id: input.content_brief_id,
      preview_mode: input.preview_mode,
    }));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
