import type { Clock } from "../../../core/time/clock";
import type { FetchSource } from "./commands/fetch-source";
import type { SourcesRepository } from "./ports/sources-repository";

export const SOURCE_FETCH_INTERVAL_MINUTES = 30;

export async function reconcileSourceFetchRuns(input: {
  sources: SourcesRepository;
  fetchSource: FetchSource;
  clock: Clock;
  limit?: number;
}) {
  const nowIso = input.clock.now().toISOString();
  const staleBefore = addMinutes(nowIso, -SOURCE_FETCH_INTERVAL_MINUTES);
  const candidates = await input.sources.listDueFetchCandidates({
    stale_before: staleBefore,
    limit: input.limit ?? 50,
  });

  let queued = 0;
  for (const candidate of candidates) {
    await input.fetchSource.execute(candidate.source_id);
    queued += 1;
  }

  return {
    queued,
  };
}

function addMinutes(isoTimestamp: string, minutes: number): string {
  return new Date(Date.parse(isoTimestamp) + minutes * 60_000).toISOString();
}
