import test from "node:test";
import assert from "node:assert/strict";
import { SqliteTrendsRepository } from "./sqlite-trends-repository";

test("SqliteTrendsRepository ranks fresher and more diverse trends above slightly higher raw-score stale trends", async () => {
  const now = Date.now();
  const oneHourAgo = new Date(now - 60 * 60_000).toISOString();
  const twoHoursAgo = new Date(now - 2 * 60 * 60_000).toISOString();
  const threeDaysAgo = new Date(now - 72 * 60 * 60_000).toISOString();
  const tenDaysAgo = new Date(now - 10 * 24 * 60 * 60_000).toISOString();

  const repository = new SqliteTrendsRepository({
    get: () => null,
    all: <T,>(sql: string): T[] => {
      if (sql.includes("FROM trends")) {
        return [
          {
            id: "trend_old",
            workspace_id: "ws_1",
            cluster_key: "old trend",
            topic: "Old Trend",
            category: "general",
            score: 8,
            status: "active",
            detected_at: tenDaysAgo,
            updated_at: threeDaysAgo,
          },
          {
            id: "trend_new",
            workspace_id: "ws_1",
            cluster_key: "trend",
            topic: "New Trend",
            category: "general",
            score: 7,
            status: "active",
            detected_at: twoHoursAgo,
            updated_at: oneHourAgo,
          },
        ] as T[];
      }

      if (sql.includes("FROM source_documents")) {
        return [
          {
            title: "Old Trend",
            source_id: "source_old",
            source_name: "Old Source",
            source_type: "rss",
            account_id: "acct_old",
            account_handle: "@old",
            published_at: tenDaysAgo,
            created_at: tenDaysAgo,
          },
          {
            title: "New Trend",
            source_id: "source_new_a",
            source_name: "Fresh RSS",
            source_type: "rss",
            account_id: "acct_a",
            account_handle: "@acct_a",
            published_at: oneHourAgo,
            created_at: oneHourAgo,
          },
          {
            title: "New Trend",
            source_id: "source_new_b",
            source_name: "Fresh Twitter",
            source_type: "twitter",
            account_id: "acct_b",
            account_handle: "@acct_b",
            published_at: twoHoursAgo,
            created_at: twoHoursAgo,
          },
        ] as T[];
      }

      return [];
    },
    run: () => ({ changes: 0 }),
  } as never);

  const trends = await repository.listByWorkspaceId("ws_1");

  assert.equal(trends[0]?.id, "trend_new");
  assert.equal(trends[0]?.source_count, 2);
  assert.equal(trends[0]?.account_count, 2);
  assert.equal(trends[1]?.id, "trend_old");
});
