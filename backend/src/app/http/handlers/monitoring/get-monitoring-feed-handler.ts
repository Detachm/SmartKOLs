import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { MonitoringFeedResponse } from "../../../../contracts/api/monitoring";
import type { GetMonitoringFeed } from "../../../../modules/monitoring/application/queries/get-monitoring-feed";

export async function getMonitoringFeedHandler(
  query: GetMonitoringFeed,
  workspaceId: string,
  limit: number,
): Promise<Result<MonitoringFeedResponse>> {
  try {
    return ok(await query.execute(workspaceId, limit));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
