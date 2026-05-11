import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { GenerateDraftRequest, GenerateDraftResponse } from "../../../../contracts/api/drafts";
import type { GenerateDraftFromContentBrief } from "../../../../modules/drafts/application/commands/generate-draft-from-content-brief";

export async function generateDraftFromContentBriefHandler(
  command: GenerateDraftFromContentBrief,
  briefId: string,
  input?: GenerateDraftRequest,
): Promise<Result<GenerateDraftResponse>> {
  try {
    return ok(await command.execute(briefId, {
      preview_mode: input?.preview_mode,
    }));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
