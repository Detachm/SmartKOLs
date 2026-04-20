import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { DashboardOverviewResponse } from "../../../../contracts/api/dashboard";
import type { GetDashboardOverview } from "../../../../modules/dashboard/application/queries/get-dashboard-overview";

export async function getDashboardOverviewHandler(
  query: GetDashboardOverview,
  workspaceId: string,
): Promise<Result<DashboardOverviewResponse>> {
  try {
    return ok(await query.execute(workspaceId));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
