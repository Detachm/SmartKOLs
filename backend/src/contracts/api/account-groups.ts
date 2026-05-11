export interface AccountGroupResponse {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface AccountGroupListItemResponse {
  group: AccountGroupResponse;
  account_count: number;
  active_account_count: number;
}

export interface AccountGroupListResponse {
  groups: AccountGroupListItemResponse[];
  summary: {
    total_groups: number;
    total_accounts: number;
    grouped_accounts: number;
    ungrouped_accounts: number;
  };
}

export interface CreateAccountGroupRequest {
  workspace_id: string;
  name: string;
  color: string;
}

export interface AssignAccountsToGroupRequest {
  account_ids: string[];
  group_id?: string;
}

export interface AssignAccountsToGroupResponse {
  workspace_id: string;
  group_id?: string;
  moved_count: number;
}
