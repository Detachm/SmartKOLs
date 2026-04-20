export interface ImportAccountRowRequest {
  handle: string;
  display_name: string;
  group_name?: string;
}

export interface ImportAccountsRequest {
  workspace_id: string;
  create_missing_groups?: boolean;
  rows: ImportAccountRowRequest[];
}

export interface ImportAccountsResponse {
  workspace_id: string;
  created_group_count: number;
  created_account_count: number;
  created_group_ids: string[];
  created_account_ids: string[];
}
