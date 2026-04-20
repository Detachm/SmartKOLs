import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { SourceListResponse } from "../../../../contracts/api/sources";
import type { ListSources } from "../../../../modules/sources/application/queries/list-sources";

export async function listSourcesHandler(
  query: ListSources,
  accountId: string,
): Promise<Result<SourceListResponse>> {
  try {
    return ok(await query.execute(accountId));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
