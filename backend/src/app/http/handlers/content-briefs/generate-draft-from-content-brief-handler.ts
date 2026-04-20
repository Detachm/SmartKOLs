import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { GenerateDraftResponse } from "../../../../contracts/api/drafts";
import type { GenerateDraftFromContentBrief } from "../../../../modules/drafts/application/commands/generate-draft-from-content-brief";

export async function generateDraftFromContentBriefHandler(
  command: GenerateDraftFromContentBrief,
  briefId: string,
): Promise<Result<GenerateDraftResponse>> {
  try {
    return ok(await command.execute(briefId));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
