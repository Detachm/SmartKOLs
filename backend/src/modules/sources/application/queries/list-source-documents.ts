import { AppError } from "../../../../core/errors/app-error";
import type { SourcesRepository } from "../ports/sources-repository";

export interface ListSourceDocumentsDependencies {
  sources: SourcesRepository;
}

export class ListSourceDocuments {
  constructor(private readonly deps: ListSourceDocumentsDependencies) {}

  async execute(sourceId: string) {
    const source = await this.deps.sources.findSourceById(sourceId);
    if (!source) {
      throw new AppError("NOT_FOUND", "source not found", {
        details: { source_id: sourceId },
      });
    }

    return {
      documents: await this.deps.sources.listDocumentsBySourceId(sourceId),
    };
  }
}
