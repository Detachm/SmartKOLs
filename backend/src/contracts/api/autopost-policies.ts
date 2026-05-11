import type { AutopostPolicy } from "../../modules/autopost/domain/autopost-policy";
import type { AutopostRun } from "../../modules/autopost/domain/autopost-run";

export interface UpsertAutopostPolicyRequest {
  cadence_body: {
    timezone: string;
    weekday_codes: Array<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun">;
    slot_times: string[];
    min_spacing_minutes: number;
  };
  content_strategy_body: {
    generation_mode: "from_trend" | "from_source_scope";
    source_types: Array<"rss" | "website" | "twitter" | "youtube" | "substack" | "telegram">;
    max_source_age_days: number;
  };
  execution_body: {
    draft_review_mode: "manual" | "auto_approve";
    auto_queue_publish: boolean;
    max_pending_manual_review_drafts?: number;
  };
  status: "active" | "paused";
}

export interface AutopostPolicyResponse {
  policy: AutopostPolicy;
  freshness?: {
    health_status: "healthy" | "degraded" | "blocked";
    refresh_grace_minutes: number;
    refresh_cutoff: string;
    relevant_source_count: number;
    fresh_source_count: number;
    stale_source_count: number;
    source_types: Array<"rss" | "website" | "twitter" | "youtube" | "substack" | "telegram">;
    latest_document_published_at?: string;
    sources: Array<{
      source_id: string;
      source_name: string;
      source_type: "rss" | "website" | "twitter" | "youtube" | "substack" | "telegram";
      source_status: "active" | "paused" | "error";
      last_fetched_at?: string;
      freshness_status: "fresh" | "stale";
    }>;
  };
}

export interface AutopostRunListResponse {
  runs: AutopostRun[];
}

export interface AutopostRunNowResponse {
  policy: AutopostPolicy;
  run: AutopostRun;
  task_id: string;
}
