import test from "node:test";
import assert from "node:assert/strict";
import { buildPublicSquareSearchQueries, rankCandidatePosts } from "./engagement-candidate-pool";

test("buildPublicSquareSearchQueries keeps explicit queries only when trend expansion is disabled", () => {
  const queries = buildPublicSquareSearchQueries({
    explicitQueries: ["AI agent", "btc etf"],
    activeTrends: [
      {
        id: "trend_1",
        workspace_id: "ws_1",
        cluster_key: "stablecoin regulation",
        topic: "Stablecoin Regulation Surge",
        category: "general",
        score: 8,
        status: "active",
        detected_at: "2026-04-22T00:00:00.000Z",
        updated_at: "2026-04-22T00:00:00.000Z",
      },
    ],
    allowTrendExpansion: false,
  });

  assert.deepEqual(queries, [
    { query: "AI agent -is:retweet", source_type: "explicit_query" },
    { query: "btc etf -is:retweet", source_type: "explicit_query" },
  ]);
});

test("buildPublicSquareSearchQueries supplements explicit queries with active trend seeds", () => {
  const queries = buildPublicSquareSearchQueries({
    explicitQueries: ["AI agent"],
    activeTrends: [
      {
        id: "trend_1",
        workspace_id: "ws_1",
        cluster_key: "stablecoin regulation",
        topic: "Stablecoin Regulation Surge",
        category: "general",
        score: 8,
        status: "active",
        detected_at: "2026-04-22T00:00:00.000Z",
        updated_at: "2026-04-22T00:00:00.000Z",
      },
      {
        id: "trend_2",
        workspace_id: "ws_1",
        cluster_key: "ai agent",
        topic: "AI Agent Breakout",
        category: "general",
        score: 7,
        status: "active",
        detected_at: "2026-04-22T00:00:00.000Z",
        updated_at: "2026-04-22T00:00:00.000Z",
      },
    ],
    allowTrendExpansion: true,
  });

  assert.equal(queries[0]?.query, "AI agent -is:retweet");
  assert.equal(queries[0]?.source_type, "explicit_query");
  assert.ok(queries.some((item) => item.query === "stablecoin regulation surge -is:retweet" && item.source_type === "trend_query"));
  assert.ok(queries.some((item) => item.query === "ai agent breakout -is:retweet" && item.source_type === "trend_query"));
});

test("rankCandidatePosts deduplicates sources and ranks fresher multi-source public-square posts first", () => {
  const now = Date.now();
  const fresh = new Date(now - 30 * 60_000).toISOString();
  const stale = new Date(now - 10 * 60 * 60_000).toISOString();

  const candidates = rankCandidatePosts({
    excludedHandle: "@self",
    excludedPostIds: new Set(["seen_post"]),
    timelineResults: [
      {
        handle: "@timeline",
        posts: [
          {
            external_post_id: "fresh_post",
            handle: "@candidate",
            kind: "post",
            content: "fresh content",
            occurred_at: fresh,
            like_count: 15,
            raw_payload: "{}",
          },
        ],
      },
    ],
    searchResults: [
      {
        query: "AI agent -is:retweet",
        source_type: "explicit_query",
        posts: [
          {
            external_post_id: "fresh_post",
            handle: "@candidate",
            kind: "post",
            content: "fresh content",
            occurred_at: fresh,
            like_count: 15,
            raw_payload: "{}",
          },
          {
            external_post_id: "seen_post",
            handle: "@other",
            kind: "post",
            content: "already seen",
            occurred_at: fresh,
            like_count: 100,
            raw_payload: "{}",
          },
        ],
      },
      {
        query: "Stablecoin Regulation -is:retweet",
        source_type: "trend_query",
        posts: [
          {
            external_post_id: "stale_post",
            handle: "@other",
            kind: "post",
            content: "older content",
            occurred_at: stale,
            like_count: 40,
            raw_payload: "{}",
          },
          {
            external_post_id: "reply_post",
            handle: "@other",
            kind: "reply",
            content: "reply content",
            occurred_at: fresh,
            like_count: 50,
            raw_payload: "{}",
          },
        ],
      },
    ],
  });

  assert.equal(candidates.length, 2);
  assert.equal(candidates[0]?.external_post_id, "fresh_post");
  assert.deepEqual(candidates[0]?.candidate_sources.map((item) => item.type).sort(), ["explicit_query", "timeline"]);
  assert.equal(candidates[1]?.external_post_id, "stale_post");
});
