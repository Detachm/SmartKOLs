import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { ContentBriefResponse } from "../../../../contracts/api/content-briefs";
import type { ArchiveContentBrief } from "../../../../modules/content-briefs/application/commands/archive-content-brief";

export async function archiveContentBriefHandler(
  command: ArchiveContentBrief,
  briefId: string,
): Promise<Result<ContentBriefResponse>> {
  try {
    return ok(await command.execute(briefId));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
