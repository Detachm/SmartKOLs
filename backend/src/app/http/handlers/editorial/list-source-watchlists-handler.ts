import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { SourceWatchlistListResponse } from "../../../../contracts/api/editorial";
import type { ListSourceWatchlists } from "../../../../modules/editorial/application/queries/list-source-watchlists";

export async function listSourceWatchlistsHandler(
  query: ListSourceWatchlists,
  accountId: string,
): Promise<Result<SourceWatchlistListResponse>> {
  try {
    return ok(await query.execute(accountId));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
