import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { CreateAccountRequest, AccountResponse } from "../../../../contracts/api/accounts";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { WorkspacesRepository } from "../../../workspaces/application/ports/workspaces-repository";
import { createAccount, normalizeHandle } from "../../domain/account";
import type { AccountGroupsRepository } from "../ports/account-groups-repository";
import type { AccountsRepository } from "../ports/accounts-repository";

export interface CreateAccountDependencies {
  workspaces: WorkspacesRepository;
  accounts: AccountsRepository;
  groups: AccountGroupsRepository;
  auditLogs: AuditLogRepository;
  clock: Clock;
}

export class CreateAccount {
  constructor(private readonly deps: CreateAccountDependencies) {}

  async execute(input: CreateAccountRequest): Promise<AccountResponse> {
    const workspace = await this.deps.workspaces.findById(input.workspace_id);
    if (!workspace) {
      throw new AppError("NOT_FOUND", "workspace not found", {
        details: { workspace_id: input.workspace_id },
      });
    }

    const normalizedHandle = normalizeHandle(input.handle);
    const existing = await this.deps.accounts.findByWorkspaceAndHandle(workspace.id, normalizedHandle);

    if (existing) {
      throw new AppError("CONFLICT", "account handle already exists in workspace", {
        details: { workspace_id: workspace.id, handle: normalizedHandle },
      });
    }

    if (input.group_id) {
      const group = await this.deps.groups.findById(input.group_id);
      if (!group) {
        throw new AppError("NOT_FOUND", "account group not found", {
          details: { group_id: input.group_id },
        });
      }

      if (group.workspace_id !== workspace.id) {
        throw new AppError("VALIDATION_ERROR", "account group must belong to the same workspace as the account", {
          details: {
            group_id: group.id,
            group_workspace_id: group.workspace_id,
            workspace_id: workspace.id,
          },
        });
      }
    }

    const now = this.deps.clock.now().toISOString();
    const account = createAccount({
      id: newId(),
      workspace_id: workspace.id,
      group_id: input.group_id,
      platform: input.platform,
      handle: normalizedHandle,
      display_name: input.display_name,
      avatar_url: input.avatar_url,
      external_account_id: input.external_account_id,
      created_at: now,
    });

    await this.deps.accounts.create(account);
    await this.deps.auditLogs.append({
      id: newId(),
      workspace_id: account.workspace_id,
      actor_type: "system",
      entity_type: "account",
      entity_id: account.id,
      action: "account.created",
      after_state: JSON.stringify(account),
      created_at: now,
    });

    return account;
  }
}
