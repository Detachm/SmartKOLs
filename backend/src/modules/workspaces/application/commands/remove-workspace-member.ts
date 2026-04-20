import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { WorkspaceMembersRepository } from "../ports/workspace-members-repository";

export interface RemoveWorkspaceMemberDependencies {
  members: WorkspaceMembersRepository;
  auditLogs: AuditLogRepository;
  clock: Clock;
}

export class RemoveWorkspaceMember {
  constructor(private readonly deps: RemoveWorkspaceMemberDependencies) {}

  async execute(input: {
    workspace_id: string;
    user_id: string;
  }) {
    const existing = await this.deps.members.find(input.workspace_id, input.user_id);
    if (!existing) {
      throw new AppError("NOT_FOUND", "workspace member not found", {
        details: input,
      });
    }

    const members = await this.deps.members.listByWorkspaceId(input.workspace_id);
    const ownerCount = members.filter((item) => item.role_code === "owner").length;
    if (existing.role_code === "owner" && ownerCount <= 1) {
      throw new AppError("INVALID_STATE", "workspace must retain at least one owner", {
        details: input,
      });
    }

    await this.deps.members.delete(input.workspace_id, input.user_id);
    await this.deps.auditLogs.append({
      id: newId(),
      workspace_id: input.workspace_id,
      actor_type: "user",
      entity_type: "workspace_member",
      entity_id: `${input.workspace_id}:${input.user_id}`,
      action: "workspace_member.deleted",
      before_state: JSON.stringify(existing),
      created_at: this.deps.clock.now().toISOString(),
    });

    return {
      workspace_id: input.workspace_id,
      user_id: input.user_id,
    };
  }
}
