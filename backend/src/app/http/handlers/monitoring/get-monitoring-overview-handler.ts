import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { MonitoringOverviewResponse } from "../../../../contracts/api/monitoring";
import type { GetMonitoringOverview } from "../../../../modules/monitoring/application/queries/get-monitoring-overview";

export async function getMonitoringOverviewHandler(
  query: GetMonitoringOverview,
  workspaceId: string,
  limit: number,
): Promise<Result<MonitoringOverviewResponse>> {
  try {
    return ok(await query.execute(workspaceId, limit));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
