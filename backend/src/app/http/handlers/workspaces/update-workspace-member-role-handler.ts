import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { UpdateWorkspaceMemberRoleRequest } from "../../../../contracts/api/settings";
import type { UpdateWorkspaceMemberRole } from "../../../../modules/workspaces/application/commands/update-workspace-member-role";
import type { WorkspaceMember } from "../../../../modules/workspaces/domain/workspace-member";

export async function updateWorkspaceMemberRoleHandler(
  command: UpdateWorkspaceMemberRole,
  workspaceId: string,
  userId: string,
  input: UpdateWorkspaceMemberRoleRequest,
): Promise<Result<WorkspaceMember>> {
  try {
    return ok(await command.execute({
      workspace_id: workspaceId,
      user_id: userId,
      role_code: input.role_code,
    }));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
