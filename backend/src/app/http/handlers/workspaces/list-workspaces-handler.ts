import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { WorkspaceListResponse } from "../../../../contracts/api/workspaces";
import type { ListWorkspaces } from "../../../../modules/workspaces/application/queries/list-workspaces";

export async function listWorkspacesHandler(
  query: ListWorkspaces,
  userId?: string,
): Promise<Result<WorkspaceListResponse>> {
  try {
    return ok(await query.execute(userId));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
