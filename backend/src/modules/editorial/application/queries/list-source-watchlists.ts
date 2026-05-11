import type { SourceWatchlistsRepository } from "../ports/source-watchlists-repository";

export interface ListSourceWatchlistsDependencies {
  watchlists: SourceWatchlistsRepository;
}

export class ListSourceWatchlists {
  constructor(private readonly deps: ListSourceWatchlistsDependencies) {}

  async execute(accountId: string) {
    return {
      watchlists: await this.deps.watchlists.listByAccountId(accountId),
    };
  }
}
