import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { RemoveSourceWatchlist } from "../../../../modules/editorial/application/commands/remove-source-watchlist";

export async function removeSourceWatchlistHandler(
  command: RemoveSourceWatchlist,
  watchlistId: string,
): Promise<Result<{ deleted: true }>> {
  try {
    await command.execute(watchlistId);
    return ok({ deleted: true as const });
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
