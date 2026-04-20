import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { UpdateWorkspaceRequest } from "../../../../contracts/api/settings";
import type { UpdateWorkspace } from "../../../../modules/workspaces/application/commands/update-workspace";
import type { Workspace } from "../../../../modules/workspaces/domain/workspace";

export async function updateWorkspaceHandler(
  command: UpdateWorkspace,
  workspaceId: string,
  input: UpdateWorkspaceRequest,
): Promise<Result<Workspace>> {
  try {
    return ok(await command.execute({ workspace_id: workspaceId, ...input }));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
