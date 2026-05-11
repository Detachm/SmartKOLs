import type { SourceWatchlist } from "../../domain/editorial";

export interface SourceWatchlistsRepository {
  findById(watchlistId: string): Promise<SourceWatchlist | null>;
  listByAccountId(accountId: string): Promise<SourceWatchlist[]>;
  save(watchlist: SourceWatchlist): Promise<void>;
  delete(watchlistId: string): Promise<void>;
}
