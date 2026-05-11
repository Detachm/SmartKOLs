import type { WorkspaceMembersRepository } from "../ports/workspace-members-repository";
import type { WorkspacesRepository } from "../ports/workspaces-repository";

export interface ListWorkspacesDependencies {
  workspaces: WorkspacesRepository;
  members: WorkspaceMembersRepository;
}

export class ListWorkspaces {
  constructor(private readonly deps: ListWorkspacesDependencies) {}

  async execute(userId?: string) {
    if (userId) {
      const memberships = await this.deps.members.listByUserId(userId);
      const workspaces = await Promise.all(
        memberships.map(async (membership) => this.deps.workspaces.findById(membership.workspace_id)),
      );

      return {
        workspaces: workspaces.filter((workspace): workspace is NonNullable<typeof workspace> => workspace !== null),
      };
    }

    return {
      workspaces: await this.deps.workspaces.listAll(),
    };
  }
}
