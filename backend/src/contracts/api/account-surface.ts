import type { AccountResponse } from "./accounts";
import type { AccountGroupResponse } from "./account-groups";

export interface AccountSurfaceResponse {
  account: AccountResponse;
  workspace: {
    id: string;
    name: string;
    slug: string;
    status: "active" | "suspended" | "closed";
    created_at: string;
    updated_at: string;
  };
  group?: AccountGroupResponse;
  health_score?: {
    id: string;
    workspace_id: string;
    account_id: string;
    score: number;
    risk_level: "low" | "medium" | "high";
    computed_at: string;
  };
  summary: {
    source_count: number;
    active_source_count: number;
    ready_briefs: number;
    pending_briefs: number;
    pending_drafts: number;
    scheduled_posts: number;
    open_threads: number;
  };
}
