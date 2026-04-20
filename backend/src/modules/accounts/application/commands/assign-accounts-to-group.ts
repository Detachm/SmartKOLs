import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import { requireNonEmptyString } from "../../../../core/validation/guards";
import type { Clock } from "../../../../core/time/clock";
import type { AssignAccountsToGroupRequest, AssignAccountsToGroupResponse } from "../../../../contracts/api/account-groups";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { AccountsRepository } from "../ports/accounts-repository";
import type { AccountGroupsRepository } from "../ports/account-groups-repository";

export interface AssignAccountsToGroupDependencies {
  accounts: AccountsRepository;
  groups: AccountGroupsRepository;
  auditLogs: AuditLogRepository;
  clock: Clock;
}

export class AssignAccountsToGroup {
  constructor(private readonly deps: AssignAccountsToGroupDependencies) {}

  async execute(input: AssignAccountsToGroupRequest): Promise<AssignAccountsToGroupResponse> {
    const requestedIds = Array.from(new Set(input.account_ids.map((accountId) => requireNonEmptyString(accountId, "account_ids[]"))));
    if (requestedIds.length === 0) {
      throw new AppError("VALIDATION_ERROR", "account_ids must include at least one account", {
        details: { field: "account_ids" },
      });
    }

    const accounts = await this.deps.accounts.listByIds(requestedIds);
    if (accounts.length !== requestedIds.length) {
      throw new AppError("VALIDATION_ERROR", "account_ids must all resolve to existing accounts", {
        details: { requested_count: requestedIds.length, resolved_count: accounts.length },
      });
    }

    const workspaceIds = Array.from(new Set(accounts.map((account) => account.workspace_id)));
    if (workspaceIds.length !== 1) {
      throw new AppError("VALIDATION_ERROR", "selected accounts must belong to the same workspace", {
        details: { workspace_ids: workspaceIds },
      });
    }

    const workspaceId = workspaceIds[0];
    if (input.group_id) {
      const group = await this.deps.groups.findById(input.group_id);
      if (!group) {
        throw new AppError("NOT_FOUND", "account group not found", {
          details: { group_id: input.group_id },
        });
      }

      if (group.workspace_id !== workspaceId) {
        throw new AppError("VALIDATION_ERROR", "account group must belong to the same workspace as the selected accounts", {
          details: { group_id: group.id, workspace_id: workspaceId, group_workspace_id: group.workspace_id },
        });
      }
    }

    const nextGroupId = input.group_id?.trim() || undefined;
    const changedAccounts = accounts.filter((account) => account.group_id !== nextGroupId);
    const now = this.deps.clock.now().toISOString();
    for (const account of changedAccounts) {
      const next = {
        ...account,
        group_id: nextGroupId,
        updated_at: now,
      };
      await this.deps.accounts.save(next);
      await this.deps.auditLogs.append({
        id: newId(),
        workspace_id: account.workspace_id,
        actor_type: "system",
        entity_type: "account",
        entity_id: account.id,
        action: "account.group_changed",
        before_state: JSON.stringify(account),
        after_state: JSON.stringify(next),
        created_at: now,
      });
    }

    return {
      workspace_id: workspaceId,
      group_id: nextGroupId,
      moved_count: changedAccounts.length,
    };
  }
}
