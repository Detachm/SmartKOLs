import { AppError } from "../../../../core/errors/app-error";
import type { SessionContextResponse } from "../../../../contracts/api/local-auth";
import type { WorkspacesRepository } from "../../../workspaces/application/ports/workspaces-repository";
import type { WorkspaceMembersRepository } from "../../../workspaces/application/ports/workspace-members-repository";
import type { UsersRepository } from "../ports/users-repository";

export interface GetUserSessionContextDependencies {
  users: UsersRepository;
  workspaces: WorkspacesRepository;
  members: WorkspaceMembersRepository;
}

export class GetUserSessionContext {
  constructor(private readonly deps: GetUserSessionContextDependencies) {}

  async execute(userId: string): Promise<SessionContextResponse> {
    const user = await this.deps.users.findById(userId);
    if (!user) {
      throw new AppError("NOT_FOUND", "user not found", {
        details: { user_id: userId },
      });
    }

    const memberships = await this.deps.members.listByUserId(userId);
    const workspaces = await Promise.all(memberships.map(async (membership) => {
      const workspace = await this.deps.workspaces.findById(membership.workspace_id);
      if (!workspace) {
        throw new AppError("INVALID_STATE", "workspace membership references missing workspace", {
          details: {
            user_id: userId,
            workspace_id: membership.workspace_id,
          },
        });
      }

      return {
        workspace,
        role_code: membership.role_code,
        joined_at: membership.joined_at,
      };
    }));

    return {
      user,
      workspaces,
    };
  }
}
