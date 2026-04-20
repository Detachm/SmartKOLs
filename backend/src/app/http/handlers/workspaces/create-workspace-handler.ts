import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { CreateWorkspaceRequest, WorkspaceResponse } from "../../../../contracts/api/workspaces";
import type { CreateWorkspace } from "../../../../modules/workspaces/application/commands/create-workspace";

export async function createWorkspaceHandler(
  command: CreateWorkspace,
  input: CreateWorkspaceRequest,
): Promise<Result<WorkspaceResponse>> {
  try {
    return ok(await command.execute(input));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
