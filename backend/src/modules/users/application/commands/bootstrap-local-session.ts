import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { WorkspacesRepository } from "../../../workspaces/application/ports/workspaces-repository";
import type { WorkspaceMembersRepository } from "../../../workspaces/application/ports/workspace-members-repository";
import { createWorkspaceMember } from "../../../workspaces/domain/workspace-member";
import type { UsersRepository } from "../ports/users-repository";
import { createUser, normalizeEmail } from "../../domain/user";

export interface BootstrapLocalSessionDependencies {
  users: UsersRepository;
  workspaces: WorkspacesRepository;
  members: WorkspaceMembersRepository;
  auditLogs: AuditLogRepository;
  clock: Clock;
}

export class BootstrapLocalSession {
  constructor(private readonly deps: BootstrapLocalSessionDependencies) {}

  async execute(input: {
    workspace_slug: string;
    email: string;
    name: string;
  }) {
    const workspace = await this.deps.workspaces.findBySlug(input.workspace_slug);
    if (!workspace) {
      throw new AppError("NOT_FOUND", "workspace not found", {
        details: { workspace_slug: input.workspace_slug },
      });
    }

    const email = normalizeEmail(input.email);
    let user = await this.deps.users.findByEmail(email);
    const now = this.deps.clock.now().toISOString();

    if (!user) {
      const existingMembers = await this.deps.members.listByWorkspaceId(workspace.id);
      if (existingMembers.length > 0) {
        throw new AppError("FORBIDDEN", "selected workspace is not open for first-owner bootstrap", {
          details: {
            workspace_id: workspace.id,
            workspace_slug: workspace.slug,
          },
        });
      }

      user = createUser({
        id: newId(),
        email,
        name: input.name,
        created_at: now,
      });
      await this.deps.users.create(user);
      await this.deps.members.save(createWorkspaceMember({
        workspace_id: workspace.id,
        user_id: user.id,
        role_code: "owner",
        joined_at: now,
      }));
      await this.deps.auditLogs.append({
        id: newId(),
        workspace_id: workspace.id,
        actor_type: "system",
        entity_type: "workspace_member",
        entity_id: `${workspace.id}:${user.id}`,
        action: "local_auth.bootstrap_owner_created",
        after_state: JSON.stringify({
          user,
          membership: {
            workspace_id: workspace.id,
            user_id: user.id,
            role_code: "owner",
            joined_at: now,
          },
        }),
        created_at: now,
      });
    }

    const membership = await this.deps.members.find(workspace.id, user.id);
    if (!membership) {
      throw new AppError("FORBIDDEN", "user is not a member of the selected workspace", {
        details: {
          user_id: user.id,
          workspace_id: workspace.id,
        },
      });
    }

    return {
      user,
      workspace,
      membership,
    };
  }
}
