import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { GenerateContentBriefRequest, GenerateContentBriefResponse } from "../../../../contracts/api/content-briefs";
import type { GenerateContentBrief } from "../../../../modules/content-briefs/application/commands/generate-content-brief";

export async function generateContentBriefHandler(
  command: GenerateContentBrief,
  accountId: string,
  input: GenerateContentBriefRequest,
): Promise<Result<GenerateContentBriefResponse>> {
  try {
    return ok(await command.execute({
      account_id: accountId,
      trend_id: input.trend_id,
      source_document_ids: input.source_document_ids,
      source_scope: input.source_scope,
      topic_hint: input.topic_hint,
      audience: input.audience,
      angle_hint: input.angle_hint,
    }));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
