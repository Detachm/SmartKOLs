import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { ContentBriefListResponse } from "../../../../contracts/api/content-briefs";
import type { ListContentBriefs } from "../../../../modules/content-briefs/application/queries/list-content-briefs";

export async function listContentBriefsHandler(
  query: ListContentBriefs,
  input: { account_id: string; limit: number },
): Promise<Result<ContentBriefListResponse>> {
  try {
    return ok(await query.execute(input));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}

