import type { Clock } from "../../../core/time/clock";
import type { WorkspacesRepository } from "../../workspaces/application/ports/workspaces-repository";
import type { RefreshTrends } from "./commands/refresh-trends";

export const TREND_REFRESH_INTERVAL_MINUTES = 30;

export async function reconcileWorkspaceTrendRefreshes(input: {
  workspaces: WorkspacesRepository;
  refreshTrends: RefreshTrends;
  lastRefreshByWorkspaceId: Map<string, string>;
  clock: Clock;
  limit?: number;
}) {
  const nowIso = input.clock.now().toISOString();
  const refreshAfter = addMinutes(nowIso, -TREND_REFRESH_INTERVAL_MINUTES);
  const workspaces = (await input.workspaces.listAll())
    .filter((workspace) => workspace.status === "active")
    .filter((workspace) => {
      const lastRefresh = input.lastRefreshByWorkspaceId.get(workspace.id);
      return !lastRefresh || lastRefresh <= refreshAfter;
    })
    .slice(0, input.limit ?? 20);

  let refreshed = 0;
  for (const workspace of workspaces) {
    input.lastRefreshByWorkspaceId.set(workspace.id, nowIso);
    await input.refreshTrends.execute(workspace.id);
    refreshed += 1;
  }

  return {
    refreshed,
  };
}

function addMinutes(isoTimestamp: string, minutes: number): string {
  return new Date(Date.parse(isoTimestamp) + minutes * 60_000).toISOString();
}
