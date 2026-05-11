import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { SourceFetchRunListResponse } from "../../../../contracts/api/source-fetch-runs";
import type { ListSourceFetchRuns } from "../../../../modules/sources/application/queries/list-source-fetch-runs";

export async function listSourceFetchRunsHandler(
  query: ListSourceFetchRuns,
  sourceId: string,
): Promise<Result<SourceFetchRunListResponse>> {
  try {
    return ok(await query.execute(sourceId));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
