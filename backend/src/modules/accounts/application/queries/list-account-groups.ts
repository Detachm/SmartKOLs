import type { AccountGroupListResponse } from "../../../../contracts/api/account-groups";
import type { AccountGroupsRepository } from "../ports/account-groups-repository";
import type { AccountsRepository } from "../ports/accounts-repository";

export interface ListAccountGroupsDependencies {
  groups: AccountGroupsRepository;
  accounts: AccountsRepository;
}

export class ListAccountGroups {
  constructor(private readonly deps: ListAccountGroupsDependencies) {}

  async execute(input?: { workspace_id?: string }): Promise<AccountGroupListResponse> {
    const [groups, accounts] = await Promise.all([
      input?.workspace_id
        ? this.deps.groups.listByWorkspaceId(input.workspace_id)
        : this.deps.groups.listAll(),
      input?.workspace_id
        ? this.deps.accounts.listByWorkspaceId(input.workspace_id)
        : this.deps.accounts.listAll(),
    ]);

    const accountCountByGroupId = new Map<string, { total: number; active: number }>();
    let groupedAccounts = 0;
    for (const account of accounts) {
      if (!account.group_id) {
        continue;
      }

      groupedAccounts += 1;
      const current = accountCountByGroupId.get(account.group_id) ?? { total: 0, active: 0 };
      current.total += 1;
      if (account.status === "active") {
        current.active += 1;
      }
      accountCountByGroupId.set(account.group_id, current);
    }

    return {
      groups: groups.map((group) => {
        const count = accountCountByGroupId.get(group.id) ?? { total: 0, active: 0 };
        return {
          group,
          account_count: count.total,
          active_account_count: count.active,
        };
      }),
      summary: {
        total_groups: groups.length,
        total_accounts: accounts.length,
        grouped_accounts: groupedAccounts,
        ungrouped_accounts: accounts.length - groupedAccounts,
      },
    };
  }
}
