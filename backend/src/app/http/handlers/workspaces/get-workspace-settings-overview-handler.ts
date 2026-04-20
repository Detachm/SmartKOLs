import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { WorkspaceSettingsOverviewResponse } from "../../../../contracts/api/settings";
import type { GetWorkspaceSettingsOverview } from "../../../../modules/workspaces/application/queries/get-workspace-settings-overview";

export async function getWorkspaceSettingsOverviewHandler(
  query: GetWorkspaceSettingsOverview,
  workspaceId: string,
): Promise<Result<WorkspaceSettingsOverviewResponse>> {
  try {
    return ok(await query.execute(workspaceId));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
