import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { AddWorkspaceMemberRequest } from "../../../../contracts/api/settings";
import type { AddWorkspaceMember } from "../../../../modules/workspaces/application/commands/add-workspace-member";

export async function addWorkspaceMemberHandler(
  command: AddWorkspaceMember,
  workspaceId: string,
  input: AddWorkspaceMemberRequest,
): Promise<Result<{ user: import("../../../../modules/users/domain/user").User; membership: import("../../../../modules/workspaces/domain/workspace-member").WorkspaceMember }>> {
  try {
    return ok(await command.execute({ workspace_id: workspaceId, ...input }));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
