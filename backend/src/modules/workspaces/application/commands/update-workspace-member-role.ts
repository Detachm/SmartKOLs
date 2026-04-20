import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { WorkspaceMembersRepository } from "../ports/workspace-members-repository";
import { createWorkspaceMember, type WorkspaceRoleCode } from "../../domain/workspace-member";

export interface UpdateWorkspaceMemberRoleDependencies {
  members: WorkspaceMembersRepository;
  auditLogs: AuditLogRepository;
  clock: Clock;
}

export class UpdateWorkspaceMemberRole {
  constructor(private readonly deps: UpdateWorkspaceMemberRoleDependencies) {}

  async execute(input: {
    workspace_id: string;
    user_id: string;
    role_code: WorkspaceRoleCode;
  }) {
    const existing = await this.deps.members.find(input.workspace_id, input.user_id);
    if (!existing) {
      throw new AppError("NOT_FOUND", "workspace member not found", {
        details: {
          workspace_id: input.workspace_id,
          user_id: input.user_id,
        },
      });
    }

    const members = await this.deps.members.listByWorkspaceId(input.workspace_id);
    const ownerCount = members.filter((item) => item.role_code === "owner").length;
    if (existing.role_code === "owner" && input.role_code !== "owner" && ownerCount <= 1) {
      throw new AppError("INVALID_STATE", "workspace must retain at least one owner", {
        details: {
          workspace_id: input.workspace_id,
          user_id: input.user_id,
        },
      });
    }

    const next = createWorkspaceMember({
      ...existing,
      role_code: input.role_code,
    });

    await this.deps.members.save(next);
    await this.deps.auditLogs.append({
      id: newId(),
      workspace_id: input.workspace_id,
      actor_type: "user",
      entity_type: "workspace_member",
      entity_id: `${input.workspace_id}:${input.user_id}`,
      action: "workspace_member.role_updated",
      before_state: JSON.stringify(existing),
      after_state: JSON.stringify(next),
      created_at: this.deps.clock.now().toISOString(),
    });

    return next;
  }
}
