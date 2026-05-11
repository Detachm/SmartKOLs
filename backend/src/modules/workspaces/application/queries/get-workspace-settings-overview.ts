import { AppError } from "../../../../core/errors/app-error";
import type { WorkspaceSettingsOverviewResponse } from "../../../../contracts/api/settings";
import type { UsersRepository } from "../../../users/application/ports/users-repository";
import type { WorkspacesRepository } from "../ports/workspaces-repository";
import type { WorkspaceMembersRepository } from "../ports/workspace-members-repository";

export interface GetWorkspaceSettingsOverviewDependencies {
  workspaces: WorkspacesRepository;
  users: UsersRepository;
  members: WorkspaceMembersRepository;
}

export class GetWorkspaceSettingsOverview {
  constructor(private readonly deps: GetWorkspaceSettingsOverviewDependencies) {}

  async execute(workspaceId: string): Promise<WorkspaceSettingsOverviewResponse> {
    const workspace = await this.deps.workspaces.findById(workspaceId);
    if (!workspace) {
      throw new AppError("NOT_FOUND", "workspace not found", {
        details: { workspace_id: workspaceId },
      });
    }

    const memberships = await this.deps.members.listByWorkspaceId(workspaceId);
    const members = await Promise.all(memberships.map(async (membership) => {
      const user = await this.deps.users.findById(membership.user_id);
      if (!user) {
        throw new AppError("INVALID_STATE", "workspace member references missing user", {
          details: {
            workspace_id: workspaceId,
            user_id: membership.user_id,
          },
        });
      }

      return {
        user,
        membership,
      };
    }));

    return {
      workspace,
      members,
      summary: {
        member_count: members.length,
        owner_count: members.filter((item) => item.membership.role_code === "owner").length,
        admin_count: members.filter((item) => item.membership.role_code === "admin").length,
        editor_count: members.filter((item) => item.membership.role_code === "editor").length,
        viewer_count: members.filter((item) => item.membership.role_code === "viewer").length,
      },
    };
  }
}
