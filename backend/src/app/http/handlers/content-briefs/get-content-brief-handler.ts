import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { ContentBriefDetailResponse } from "../../../../contracts/api/content-briefs";
import type { GetContentBrief } from "../../../../modules/content-briefs/application/queries/get-content-brief";

export async function getContentBriefHandler(
  query: GetContentBrief,
  briefId: string,
): Promise<Result<ContentBriefDetailResponse>> {
  try {
    return ok(await query.execute(briefId));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}

