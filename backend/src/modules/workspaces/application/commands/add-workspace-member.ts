import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { UsersRepository } from "../../../users/application/ports/users-repository";
import { createUser, normalizeEmail } from "../../../users/domain/user";
import type { WorkspacesRepository } from "../ports/workspaces-repository";
import type { WorkspaceMembersRepository } from "../ports/workspace-members-repository";
import { createWorkspaceMember, type WorkspaceRoleCode } from "../../domain/workspace-member";

export interface AddWorkspaceMemberDependencies {
  workspaces: WorkspacesRepository;
  users: UsersRepository;
  members: WorkspaceMembersRepository;
  auditLogs: AuditLogRepository;
  clock: Clock;
}

export class AddWorkspaceMember {
  constructor(private readonly deps: AddWorkspaceMemberDependencies) {}

  async execute(input: {
    workspace_id: string;
    email: string;
    name: string;
    role_code: WorkspaceRoleCode;
  }) {
    const workspace = await this.deps.workspaces.findById(input.workspace_id);
    if (!workspace) {
      throw new AppError("NOT_FOUND", "workspace not found", {
        details: { workspace_id: input.workspace_id },
      });
    }

    const email = normalizeEmail(input.email);
    let user = await this.deps.users.findByEmail(email);
    const now = this.deps.clock.now().toISOString();

    if (!user) {
      user = createUser({
        id: newId(),
        email,
        name: input.name,
        created_at: now,
      });
      await this.deps.users.create(user);
    }

    const existing = await this.deps.members.find(workspace.id, user.id);
    if (existing) {
      throw new AppError("CONFLICT", "workspace member already exists", {
        details: {
          workspace_id: workspace.id,
          user_id: user.id,
        },
      });
    }

    const member = createWorkspaceMember({
      workspace_id: workspace.id,
      user_id: user.id,
      role_code: input.role_code,
      joined_at: now,
    });
    await this.deps.members.save(member);
    await this.deps.auditLogs.append({
      id: newId(),
      workspace_id: workspace.id,
      actor_type: "user",
      entity_type: "workspace_member",
      entity_id: `${workspace.id}:${user.id}`,
      action: "workspace_member.created",
      after_state: JSON.stringify({ user, membership: member }),
      created_at: now,
    });

    return {
      user,
      membership: member,
    };
  }
}
