import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { SourceWatchlistResponse, UpsertSourceWatchlistRequest } from "../../../../contracts/api/editorial";
import type { UpsertSourceWatchlist } from "../../../../modules/editorial/application/commands/upsert-source-watchlist";

export async function upsertSourceWatchlistHandler(
  command: UpsertSourceWatchlist,
  accountId: string,
  input: UpsertSourceWatchlistRequest,
  watchlistId?: string,
): Promise<Result<SourceWatchlistResponse>> {
  try {
    return ok(await command.execute({
      watchlist_id: watchlistId,
      account_id: accountId,
      ...input,
    }));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
