import type { SourcesRepository } from "../ports/sources-repository";

export interface ListSourcesDependencies {
  sources: SourcesRepository;
}

export class ListSources {
  constructor(private readonly deps: ListSourcesDependencies) {}

  async execute(accountId: string) {
    return {
      sources: await this.deps.sources.listSourcesByAccountId(accountId),
    };
  }
}
