import { AppError } from "../../../core/errors/app-error";
import type { SourceFetcher } from "../application/ports/source-fetcher";

export class NotConfiguredSourceFetcher implements SourceFetcher {
  async fetch(): Promise<never> {
    throw new AppError("EXTERNAL_DEPENDENCY_ERROR", "source fetcher is not configured", {
      details: { dependency: "sources.fetcher" },
    });
  }
}
