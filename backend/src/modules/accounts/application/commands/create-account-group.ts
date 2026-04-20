import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { CreateAccountGroupRequest, AccountGroupResponse } from "../../../../contracts/api/account-groups";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import { createAccountGroup, normalizeAccountGroupName } from "../../domain/account-group";
import type { AccountGroupsRepository } from "../ports/account-groups-repository";
import type { WorkspacesRepository } from "../../../workspaces/application/ports/workspaces-repository";

export interface CreateAccountGroupDependencies {
  groups: AccountGroupsRepository;
  workspaces: WorkspacesRepository;
  auditLogs: AuditLogRepository;
  clock: Clock;
}

export class CreateAccountGroup {
  constructor(private readonly deps: CreateAccountGroupDependencies) {}

  async execute(input: CreateAccountGroupRequest): Promise<AccountGroupResponse> {
    const workspace = await this.deps.workspaces.findById(input.workspace_id);
    if (!workspace) {
      throw new AppError("NOT_FOUND", "workspace not found", {
        details: { workspace_id: input.workspace_id },
      });
    }

    const normalizedName = normalizeAccountGroupName(input.name);
    const existing = await this.deps.groups.findByWorkspaceAndName(workspace.id, normalizedName);
    if (existing) {
      throw new AppError("CONFLICT", "account group name already exists in workspace", {
        details: { workspace_id: workspace.id, name: normalizedName },
      });
    }

    const now = this.deps.clock.now().toISOString();
    const group = createAccountGroup({
      id: newId(),
      workspace_id: workspace.id,
      name: normalizedName,
      color: input.color,
      created_at: now,
    });

    await this.deps.groups.create(group);
    await this.deps.auditLogs.append({
      id: newId(),
      workspace_id: workspace.id,
      actor_type: "system",
      entity_type: "account_group",
      entity_id: group.id,
      action: "account_group.created",
      after_state: JSON.stringify(group),
      created_at: now,
    });

    return group;
  }
}
