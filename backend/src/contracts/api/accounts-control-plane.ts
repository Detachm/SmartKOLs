import type { AccountGroupListItemResponse } from "./account-groups";
import type { AccountResponse } from "./accounts";
import type { WorkspaceResponse } from "./workspaces";

export interface AccountsControlPlaneResponse {
  workspaces: WorkspaceResponse[];
  accounts: AccountResponse[];
  groups: AccountGroupListItemResponse[];
  summary: {
    total_workspaces: number;
    total_accounts: number;
    active_accounts: number;
    bound_accounts: number;
    total_groups: number;
    grouped_accounts: number;
    ungrouped_accounts: number;
  };
}
