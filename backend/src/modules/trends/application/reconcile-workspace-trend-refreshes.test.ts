import test from "node:test";
import assert from "node:assert/strict";
import {
  reconcileWorkspaceTrendRefreshes,
  TREND_REFRESH_INTERVAL_MINUTES,
} from "./reconcile-workspace-trend-refreshes";

test("reconcileWorkspaceTrendRefreshes refreshes active workspaces with interval throttling", async () => {
  const refreshedWorkspaceIds: string[] = [];
  const lastRefreshByWorkspaceId = new Map<string, string>([
    ["ws_recent", "2026-04-21T09:50:00.000Z"],
    ["ws_due", "2026-04-21T09:00:00.000Z"],
  ]);

  const result = await reconcileWorkspaceTrendRefreshes({
    workspaces: {
      listAll: async () => [{
        id: "ws_recent",
        name: "Recent",
        slug: "recent",
        status: "active",
        created_at: "2026-04-21T08:00:00.000Z",
        updated_at: "2026-04-21T08:00:00.000Z",
      }, {
        id: "ws_due",
        name: "Due",
        slug: "due",
        status: "active",
        created_at: "2026-04-21T08:00:00.000Z",
        updated_at: "2026-04-21T08:00:00.000Z",
      }, {
        id: "ws_suspended",
        name: "Suspended",
        slug: "suspended",
        status: "suspended",
        created_at: "2026-04-21T08:00:00.000Z",
        updated_at: "2026-04-21T08:00:00.000Z",
      }],
    } as never,
    refreshTrends: {
      execute: async (workspaceId: string) => {
        refreshedWorkspaceIds.push(workspaceId);
        return { refreshed_count: 1, archived_count: 0 };
      },
    } as never,
    lastRefreshByWorkspaceId,
    clock: {
      now: () => new Date("2026-04-21T10:00:00.000Z"),
    },
    limit: 10,
  });

  assert.equal(TREND_REFRESH_INTERVAL_MINUTES, 30);
  assert.equal(result.refreshed, 1);
  assert.deepEqual(refreshedWorkspaceIds, ["ws_due"]);
  assert.equal(lastRefreshByWorkspaceId.get("ws_due"), "2026-04-21T10:00:00.000Z");
});
