import type { AccountResponse } from "./accounts";
import type { WorkspaceResponse } from "./workspaces";

export interface WorkspaceSurfaceAccountPreview
  extends Pick<
    AccountResponse,
    "id" | "workspace_id" | "group_id" | "handle" | "display_name" | "avatar_url" | "status" | "external_account_id"
  > {}

export interface WorkspaceSurfaceResponse {
  workspace: WorkspaceResponse;
  summary: {
    total_accounts: number;
    active_accounts: number;
    bound_accounts: number;
    total_groups: number;
    grouped_accounts: number;
    ungrouped_accounts: number;
    pending_drafts: number;
    scheduled_posts: number;
    unread_notifications: number;
    active_trends: number;
    open_threads: number;
    configured_alert_channels: number;
    member_count: number;
    failed_queue_items: number;
  };
  active_accounts: WorkspaceSurfaceAccountPreview[];
}
