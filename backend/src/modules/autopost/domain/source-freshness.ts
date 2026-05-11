import type { Source } from "../../sources/domain/source";

export const AUTOPOST_SOURCE_REFRESH_GRACE_MINUTES = 15;

export interface AutopostSourceFreshnessSummary {
  health_status: "healthy" | "degraded" | "blocked";
  refresh_grace_minutes: number;
  refresh_cutoff: string;
  relevant_source_count: number;
  fresh_source_count: number;
  stale_source_count: number;
  source_types: Source["type"][];
  latest_document_published_at?: string;
  sources: Array<{
    source_id: string;
    source_name: string;
    source_type: Source["type"];
    source_status: Source["status"];
    last_fetched_at?: string;
    freshness_status: "fresh" | "stale";
  }>;
}

export function summarizeAutopostSourceFreshness(input: {
  started_at: string;
  source_types: Source["type"][];
  relevant_sources: Source[];
  latest_document_published_at?: string;
}): AutopostSourceFreshnessSummary {
  const refreshCutoff = computeAutopostSourceRefreshCutoff(input.started_at);
  const sources = input.relevant_sources.map((source) => ({
    source_id: source.id,
    source_name: source.name,
    source_type: source.type,
    source_status: source.status,
    last_fetched_at: source.last_fetched_at,
    freshness_status: isSourceFresh(source, refreshCutoff) ? "fresh" as const : "stale" as const,
  }));
  const freshSourceCount = sources.filter((source) => source.freshness_status === "fresh").length;
  const staleSourceCount = sources.length - freshSourceCount;

  return {
    health_status: resolveFreshnessHealthStatus(sources.length, freshSourceCount),
    refresh_grace_minutes: AUTOPOST_SOURCE_REFRESH_GRACE_MINUTES,
    refresh_cutoff: refreshCutoff,
    relevant_source_count: sources.length,
    fresh_source_count: freshSourceCount,
    stale_source_count: staleSourceCount,
    source_types: input.source_types,
    latest_document_published_at: input.latest_document_published_at,
    sources,
  };
}

export function computeAutopostSourceRefreshCutoff(startedAt: string) {
  return new Date(Date.parse(startedAt) - AUTOPOST_SOURCE_REFRESH_GRACE_MINUTES * 60_000).toISOString();
}

export function isSourceFresh(source: Pick<Source, "last_fetched_at">, refreshCutoff: string) {
  return typeof source.last_fetched_at === "string" && source.last_fetched_at >= refreshCutoff;
}

function resolveFreshnessHealthStatus(relevantSourceCount: number, freshSourceCount: number) {
  if (relevantSourceCount === 0 || freshSourceCount === 0) {
    return "blocked";
  }

  if (freshSourceCount < relevantSourceCount) {
    return "degraded";
  }

  return "healthy";
}
