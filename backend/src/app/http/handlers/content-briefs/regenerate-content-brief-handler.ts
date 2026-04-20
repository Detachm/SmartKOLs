import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { GenerateContentBriefResponse } from "../../../../contracts/api/content-briefs";
import type { RegenerateContentBrief } from "../../../../modules/content-briefs/application/commands/regenerate-content-brief";

export async function regenerateContentBriefHandler(
  command: RegenerateContentBrief,
  briefId: string,
): Promise<Result<GenerateContentBriefResponse>> {
  try {
    return ok(await command.execute(briefId));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
