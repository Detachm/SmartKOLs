import type { AccountGroupListItemResponse } from "./account-groups";
import type { Notification } from "../../modules/notifications/domain/notification";

export interface AppChromeOverviewResponse {
  summary: {
    total_groups: number;
    total_accounts: number;
    active_accounts: number;
    bound_accounts: number;
    grouped_accounts: number;
    ungrouped_accounts: number;
    pending_drafts: number;
    scheduled_posts: number;
    unread_notifications: number;
    critical_alerts: number;
    failed_queue_items: number;
    monitoring_attention_items: number;
  };
  group_links: AccountGroupListItemResponse[];
  recent_notifications: Notification[];
}

export interface AppCommandSearchResult {
  id: string;
  kind: "page" | "account_group" | "account" | "draft" | "content_brief";
  page_code?: "dashboard" | "accounts" | "calendar" | "drafts" | "monitoring" | "settings";
  label: string;
  sublabel?: string;
  href: string;
  badge?: string;
  updated_at?: string;
}

export interface AppCommandSearchResponse {
  query: string;
  results: AppCommandSearchResult[];
}
