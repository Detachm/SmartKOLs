import test from "node:test";
import assert from "node:assert/strict";
import { GetAutopostPolicy } from "./get-autopost-policy";

test("GetAutopostPolicy returns freshness summary for relevant active sources", async () => {
  const query = new GetAutopostPolicy({
    policies: {
      findByAccountId: async () => ({
        id: "policy_1",
        workspace_id: "ws_1",
        account_id: "acct_1",
        cadence_body: {
          timezone: "UTC",
          weekday_codes: ["mon"],
          slot_times: ["09:00"],
          min_spacing_minutes: 60,
        },
        content_strategy_body: {
          generation_mode: "from_source_scope",
          source_types: ["rss", "twitter"],
          max_source_age_days: 7,
        },
        execution_body: {
          draft_review_mode: "manual",
          auto_queue_publish: false,
        },
        status: "active",
        updated_at: "2026-04-22T11:00:00.000Z",
      }),
    } as never,
    sources: {
      listSourcesByAccountId: async () => ([
        {
          id: "source_fresh",
          workspace_id: "ws_1",
          account_id: "acct_1",
          type: "rss",
          name: "Fresh RSS",
          url: "https://example.com/rss",
          status: "active",
          last_fetched_at: "2026-04-22T11:58:00.000Z",
          created_at: "2026-04-22T11:00:00.000Z",
        },
        {
          id: "source_stale",
          workspace_id: "ws_1",
          account_id: "acct_1",
          type: "twitter",
          name: "Stale Twitter",
          url: "https://x.com/example",
          status: "active",
          last_fetched_at: "2026-04-22T11:30:00.000Z",
          created_at: "2026-04-22T11:00:00.000Z",
        },
        {
          id: "source_paused",
          workspace_id: "ws_1",
          account_id: "acct_1",
          type: "rss",
          name: "Paused RSS",
          url: "https://example.com/paused",
          status: "paused",
          last_fetched_at: "2026-04-22T11:59:00.000Z",
          created_at: "2026-04-22T11:00:00.000Z",
        },
      ]),
    } as never,
    sourceDocuments: {
      listAccountSourceDocuments: async () => ({
        documents: [
          {
            source: {
              id: "source_fresh",
              workspace_id: "ws_1",
              account_id: "acct_1",
              type: "rss",
              name: "Fresh RSS",
              url: "https://example.com/rss",
              status: "active",
              last_fetched_at: "2026-04-22T11:58:00.000Z",
              created_at: "2026-04-22T11:00:00.000Z",
            },
            document: {
              id: "doc_1",
              workspace_id: "ws_1",
              source_id: "source_fresh",
              canonical_url: "https://example.com/doc",
              title: "Doc",
              summary: "Summary",
              body_text: "Body",
              language: "en",
              published_at: "2026-04-22T11:50:00.000Z",
              content_hash: "hash_1",
              created_at: "2026-04-22T11:50:00.000Z",
            },
          },
        ],
      }),
    } as never,
    clock: {
      now: () => new Date("2026-04-22T12:00:00.000Z"),
    },
  });

  const result = await query.execute("acct_1");

  assert.equal(result.freshness?.health_status, "degraded");
  assert.equal(result.freshness?.relevant_source_count, 2);
  assert.equal(result.freshness?.fresh_source_count, 1);
  assert.equal(result.freshness?.stale_source_count, 1);
  assert.equal(result.freshness?.latest_document_published_at, "2026-04-22T11:50:00.000Z");
  assert.deepEqual(
    result.freshness?.sources.map((source) => ({
      id: source.source_id,
      freshness_status: source.freshness_status,
    })),
    [
      { id: "source_fresh", freshness_status: "fresh" },
      { id: "source_stale", freshness_status: "stale" },
    ],
  );
});
