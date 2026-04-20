import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { ContentBriefEvidenceListResponse } from "../../../../contracts/api/content-briefs";
import type { GetContentBriefEvidence } from "../../../../modules/content-briefs/application/queries/get-content-brief-evidence";

export async function getContentBriefEvidenceHandler(
  query: GetContentBriefEvidence,
  briefId: string,
): Promise<Result<ContentBriefEvidenceListResponse>> {
  try {
    return ok(await query.execute(briefId));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
