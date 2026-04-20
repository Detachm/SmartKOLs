import { AppError } from "../../../core/errors/app-error";
import type { SourceFetchAdapter } from "../application/ports/source-fetch-adapter";
import type { SourceFetcher, SourceFetcherResult } from "../application/ports/source-fetcher";
import type { Source } from "../domain/source";
import { normalizeSourceFetchError } from "./source-fetch-error-normalizer";
import { normalizeSourceFetchDocuments } from "./source-fetch-result-normalizer";

export class RegistrySourceFetcher implements SourceFetcher {
  private readonly adaptersByType: Map<Source["type"], SourceFetchAdapter>;

  constructor(
    adapters: SourceFetchAdapter[],
    private readonly runtime: Parameters<SourceFetchAdapter["fetch"]>[1],
  ) {
    this.adaptersByType = new Map();

    for (const adapter of adapters) {
      if (this.adaptersByType.has(adapter.source_type)) {
        throw new AppError("INTERNAL_ERROR", `duplicate source fetch adapter for type ${adapter.source_type}`, {
          details: { source_type: adapter.source_type },
        });
      }

      this.adaptersByType.set(adapter.source_type, adapter);
    }
  }

  async fetch(source: Source): Promise<SourceFetcherResult> {
    const adapter = this.adaptersByType.get(source.type);
    if (!adapter) {
      throw new AppError("SOURCE_FETCH_UNSUPPORTED", "source type is not supported by configured fetch adapters", {
        details: {
          source_id: source.id,
          source_type: source.type,
        },
      });
    }

    try {
      const result = await adapter.fetch(source, this.runtime);
      return {
        documents: normalizeSourceFetchDocuments(source, result.documents),
        raw_response: result.raw_response,
        raw_response_extension: result.raw_response_extension,
      };
    } catch (error) {
      throw normalizeSourceFetchError(error);
    }
  }
}
