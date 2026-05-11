import test from "node:test";
import assert from "node:assert/strict";
import {
  reconcileSourceFetchRuns,
  SOURCE_FETCH_INTERVAL_MINUTES,
} from "./reconcile-source-fetch-runs";

test("reconcileSourceFetchRuns queues due active source fetch runs", async () => {
  const fetchedSourceIds: string[] = [];

  const result = await reconcileSourceFetchRuns({
    sources: {
      listDueFetchCandidates: async (input: { stale_before: string; limit: number }) => {
        assert.equal(input.stale_before, "2026-04-21T09:30:00.000Z");
        assert.equal(input.limit, 2);
        return [{
          source_id: "source_1",
          workspace_id: "ws_1",
          account_id: "acct_1",
        }, {
          source_id: "source_2",
          workspace_id: "ws_1",
          account_id: "acct_1",
          last_fetched_at: "2026-04-21T09:00:00.000Z",
        }];
      },
    } as never,
    fetchSource: {
      execute: async (sourceId: string) => {
        fetchedSourceIds.push(sourceId);
        return { run_id: `run_${sourceId}`, status: "queued" };
      },
    } as never,
    clock: {
      now: () => new Date("2026-04-21T10:00:00.000Z"),
    },
    limit: 2,
  });

  assert.equal(SOURCE_FETCH_INTERVAL_MINUTES, 30);
  assert.equal(result.queued, 2);
  assert.deepEqual(fetchedSourceIds, ["source_1", "source_2"]);
});
