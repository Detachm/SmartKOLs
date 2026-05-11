import { AppError } from "../../../../core/errors/app-error";
import type { SourcesRepository } from "../ports/sources-repository";

export interface ListSourceFetchRunsDependencies {
  sources: SourcesRepository;
}

export class ListSourceFetchRuns {
  constructor(private readonly deps: ListSourceFetchRunsDependencies) {}

  async execute(sourceId: string) {
    const source = await this.deps.sources.findSourceById(sourceId);
    if (!source) {
      throw new AppError("NOT_FOUND", "source not found", {
        details: { source_id: sourceId },
      });
    }

    return {
      runs: await this.deps.sources.listFetchRunsBySourceId(sourceId),
    };
  }
}
