export interface AccountAnalyticsDailyPoint {
  date: string;
  drafts_created: number;
  posts_published: number;
  source_documents: number;
  connector_failures: number;
}

export interface AccountAnalyticsHeatmapPoint {
  weekday_code: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
  hour: number;
  published_posts: number;
}

export interface AccountAnalyticsRecentPost {
  id: string;
  external_post_id: string;
  external_post_url?: string;
  content: string;
  published_at: string;
}

export interface AccountAnalyticsConnectorFailure {
  id: string;
  endpoint_code: string;
  error_code?: string;
  error_message?: string;
  started_at: string;
}

export interface AccountAnalyticsResponse {
  account: {
    id: string;
    workspace_id: string;
    handle: string;
    display_name: string;
    avatar_url?: string;
    status: "active" | "paused" | "disabled" | "error";
    external_account_id?: string;
  };
  summary: {
    window_days: number;
    drafts_created: number;
    drafts_approved: number;
    drafts_rejected: number;
    approval_rate?: number;
    posts_published: number;
    publish_success_rate?: number;
    source_documents: number;
    connector_failures: number;
    current_health_score?: number;
    current_risk_level?: "low" | "medium" | "high";
  };
  daily_activity: AccountAnalyticsDailyPoint[];
  publish_heatmap: AccountAnalyticsHeatmapPoint[];
  recent_published_posts: AccountAnalyticsRecentPost[];
  recent_connector_failures: AccountAnalyticsConnectorFailure[];
}
