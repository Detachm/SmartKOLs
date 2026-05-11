import type { TwitterTimelinePost } from "../../connector-x/application/ports/twitter-client";
import type { Trend } from "../../trends/domain/trend";
import { normalizeTrendClusterKey } from "../../trends/domain/trend-clustering";
import { uniqueNonEmptyStrings } from "./automation-policy-helpers";

export interface CandidatePostSource {
  label: string;
  type: "timeline" | "explicit_query" | "trend_query";
}

export interface ExpandedSearchQuery {
  query: string;
  source_type: "explicit_query" | "trend_query";
}

export interface RankedCandidatePost extends TwitterTimelinePost {
  candidate_score: number;
  candidate_sources: CandidatePostSource[];
}

export function buildPublicSquareSearchQueries(input: {
  explicitQueries: string[];
  activeTrends: Trend[];
  limit?: number;
  allowTrendExpansion?: boolean;
}): ExpandedSearchQuery[] {
  const limit = Math.max(1, Math.min(12, input.limit ?? 6));
  const queries = new Map<string, ExpandedSearchQuery>();

  for (const query of uniqueNonEmptyStrings(input.explicitQueries)) {
    const normalized = normalizeSearchQuery(query);
    if (!normalized) {
      continue;
    }

    queries.set(normalized.toLowerCase(), {
      query: normalized,
      source_type: "explicit_query",
    });
    if (queries.size >= limit) {
      return Array.from(queries.values());
    }
  }

  if (input.allowTrendExpansion !== true) {
    return Array.from(queries.values());
  }

  for (const trend of input.activeTrends.filter((item) => item.status === "active")) {
    const seed = buildTrendSearchSeed(trend);
    const normalized = normalizeSearchQuery(seed);
    if (!normalized || queries.has(normalized.toLowerCase())) {
      continue;
    }

    queries.set(normalized.toLowerCase(), {
      query: normalized,
      source_type: "trend_query",
    });
    if (queries.size >= limit) {
      break;
    }
  }

  return Array.from(queries.values());
}

export function rankCandidatePosts(input: {
  timelineResults?: Array<{
    handle: string;
    posts: TwitterTimelinePost[];
  }>;
  searchResults?: Array<{
    query: string;
    source_type: "explicit_query" | "trend_query";
    posts: TwitterTimelinePost[];
  }>;
  excludedPostIds?: Set<string>;
  excludedHandle?: string;
  minLikeCount?: number;
}): RankedCandidatePost[] {
  const candidates = new Map<string, {
    post: TwitterTimelinePost;
    sources: Map<string, CandidatePostSource>;
  }>();
  const excludedHandle = input.excludedHandle?.toLowerCase();
  const excludedPostIds = input.excludedPostIds ?? new Set<string>();
  const minLikeCount = Math.max(0, input.minLikeCount ?? 0);

  for (const timeline of input.timelineResults ?? []) {
    const source: CandidatePostSource = {
      label: `timeline:${timeline.handle}`,
      type: "timeline",
    };
    addPostsToCandidateMap(candidates, timeline.posts, source, {
      excludedHandle,
      excludedPostIds,
      minLikeCount,
    });
  }

  for (const search of input.searchResults ?? []) {
    const source: CandidatePostSource = {
      label: `${search.source_type}:${search.query}`,
      type: search.source_type,
    };
    addPostsToCandidateMap(candidates, search.posts, source, {
      excludedHandle,
      excludedPostIds,
      minLikeCount,
    });
  }

  return Array.from(candidates.values())
    .map((entry) => ({
      ...entry.post,
      candidate_score: scoreCandidate(entry.post, Array.from(entry.sources.values())),
      candidate_sources: Array.from(entry.sources.values()),
    }))
    .sort((left, right) => {
      if (right.candidate_score !== left.candidate_score) {
        return right.candidate_score - left.candidate_score;
      }

      return new Date(right.occurred_at).getTime() - new Date(left.occurred_at).getTime();
    });
}

function addPostsToCandidateMap(
  candidates: Map<string, {
    post: TwitterTimelinePost;
    sources: Map<string, CandidatePostSource>;
  }>,
  posts: TwitterTimelinePost[],
  source: CandidatePostSource,
  input: {
    excludedHandle?: string;
    excludedPostIds: Set<string>;
    minLikeCount: number;
  },
) {
  for (const post of posts) {
    const postKey = post.external_post_id.trim().toLowerCase();
    if (post.kind !== "post" || postKey === "" || input.excludedPostIds.has(postKey)) {
      continue;
    }

    if (input.excludedHandle && post.handle.trim().toLowerCase() === input.excludedHandle) {
      continue;
    }

    if ((post.like_count ?? 0) < input.minLikeCount) {
      continue;
    }

    const existing = candidates.get(postKey);
    if (existing) {
      existing.sources.set(source.label, source);
      if (new Date(post.occurred_at).getTime() > new Date(existing.post.occurred_at).getTime()) {
        existing.post = post;
      }
      continue;
    }

    candidates.set(postKey, {
      post,
      sources: new Map([[source.label, source]]),
    });
  }
}

function scoreCandidate(post: TwitterTimelinePost, sources: CandidatePostSource[]) {
  const ageHours = (Date.now() - new Date(post.occurred_at).getTime()) / 3_600_000;
  const freshnessScore = ageHours <= 2
    ? 40
    : ageHours <= 6
      ? 30
      : ageHours <= 24
        ? 20
        : ageHours <= 72
          ? 10
          : 0;
  const likeScore = Math.min(30, Math.floor((post.like_count ?? 0) / 5));
  const timelineBoost = sources.some((source) => source.type === "timeline") ? 10 : 0;
  const explicitQueryBoost = sources.filter((source) => source.type === "explicit_query").length * 8;
  const trendQueryBoost = sources.filter((source) => source.type === "trend_query").length * 5;
  const multiSourceBoost = Math.max(0, sources.length - 1) * 4;

  return freshnessScore + likeScore + timelineBoost + explicitQueryBoost + trendQueryBoost + multiSourceBoost;
}

function buildTrendSearchSeed(trend: Trend) {
  const clusterKey = normalizeTrendClusterKey(trend.topic || trend.cluster_key);
  const terms = clusterKey.split(/\s+/).map((term: string) => term.trim()).filter(Boolean);
  return terms.slice(0, 4).join(" ");
}

function normalizeSearchQuery(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  const withFilters = /\bis:retweet\b/i.test(normalized)
    ? normalized
    : `${normalized} -is:retweet`;

  return withFilters.length > 180 ? withFilters.slice(0, 180).trim() : withFilters;
}
