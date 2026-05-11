import type { Notification } from "../../modules/notifications/domain/notification";
import type { Trend } from "../../modules/trends/domain/trend";

export interface DashboardAccountPreview {
  id: string;
  handle: string;
  display_name: string;
  avatar_url?: string;
  status: "active" | "paused" | "disabled" | "error";
  follower_count: number;
  external_account_id?: string;
  updated_at: string;
}

export interface DashboardPendingDraftPreview {
  id: string;
  account_id: string;
  topic: string;
  updated_at: string;
  account: {
    id: string;
    handle: string;
    display_name: string;
    avatar_url?: string;
    status: "active" | "paused" | "disabled" | "error";
  };
}

export interface DashboardOverviewResponse {
  summary: {
    total_accounts: number;
    active_accounts: number;
    total_followers: number;
    pending_drafts: number;
    unread_notifications: number;
    active_trends: number;
  };
  recent_accounts: DashboardAccountPreview[];
  pending_drafts_preview: DashboardPendingDraftPreview[];
  trends: Trend[];
  notifications: Notification[];
}
