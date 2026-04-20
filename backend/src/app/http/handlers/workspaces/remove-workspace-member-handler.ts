import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { RemoveWorkspaceMember } from "../../../../modules/workspaces/application/commands/remove-workspace-member";

export async function removeWorkspaceMemberHandler(
  command: RemoveWorkspaceMember,
  workspaceId: string,
  userId: string,
): Promise<Result<{ workspace_id: string; user_id: string }>> {
  try {
    return ok(await command.execute({
      workspace_id: workspaceId,
      user_id: userId,
    }));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
