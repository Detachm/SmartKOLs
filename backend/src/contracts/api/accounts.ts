export interface CreateAccountRequest {
  workspace_id: string;
  group_id?: string;
  platform: "x";
  handle: string;
  display_name: string;
  avatar_url?: string;
  external_account_id?: string;
}

export interface AccountResponse {
  id: string;
  workspace_id: string;
  group_id?: string;
  platform: "x";
  handle: string;
  display_name: string;
  avatar_url?: string;
  status: "active" | "paused" | "disabled" | "error";
  follower_count: number;
  following_count: number;
  post_count: number;
  external_account_id?: string;
  created_at: string;
  updated_at: string;
}

export interface AccountListResponse {
  accounts: AccountResponse[];
}

export interface DeleteAccountResponse {
  deleted_account_id: string;
  workspace_id: string;
}

export interface SyncAccountProfileResponse {
  account: AccountResponse;
  health_score: {
    id: string;
    workspace_id: string;
    account_id: string;
    score: number;
    risk_level: "low" | "medium" | "high";
    computed_at: string;
  };
}
