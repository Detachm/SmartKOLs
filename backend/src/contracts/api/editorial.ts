import type { SourceType } from "../../modules/sources/domain/source";
import type { SourceWatchlist, RecurringBriefPlan, RecurringBriefPlanQueueItem } from "../../modules/editorial/domain/editorial";

export interface SourceWatchlistResponse {
  watchlist: SourceWatchlist;
}

export interface SourceWatchlistListResponse {
  watchlists: SourceWatchlist[];
}

export interface UpsertSourceWatchlistRequest {
  name: string;
  description?: string;
  scope_body: {
    source_ids: string[];
    source_types: SourceType[];
    preferred_source_ids: string[];
    preferred_source_types: SourceType[];
    query?: string;
    max_source_age_days: number;
    limit: number;
  };
  status: "active" | "paused";
}

export interface RecurringBriefPlanListItemResponse {
  plan: RecurringBriefPlan;
  watchlist?: SourceWatchlist;
  queued_campaign_count: number;
}

export interface RecurringBriefPlanListResponse {
  plans: RecurringBriefPlanListItemResponse[];
}

export interface UpsertRecurringBriefPlanRequest {
  name: string;
  description?: string;
  cadence_body: {
    timezone: string;
    weekday_codes: Array<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun">;
    slot_times: string[];
    min_spacing_minutes: number;
  };
  strategy_body: {
    generation_mode: "from_trend" | "from_source_scope";
    watchlist_id?: string;
    source_scope_body?: {
      source_ids: string[];
      source_types: SourceType[];
      preferred_source_ids: string[];
      preferred_source_types: SourceType[];
      query?: string;
      max_source_age_days: number;
      limit: number;
    };
    default_topic_hint?: string;
    default_angle_hint?: string;
    default_audience?: string;
    campaign_queue: Array<{
      id?: string;
      title: string;
      topic_hint: string;
      angle_hint?: string;
      audience?: string;
    }>;
  };
  status: "active" | "paused";
}

export interface RecurringBriefPlanResponse {
  plan: RecurringBriefPlan;
}

export interface RecurringBriefPlanRunNowResponse {
  plan: RecurringBriefPlan;
  brief_id: string;
  task_id: string;
  consumed_campaign_item?: RecurringBriefPlanQueueItem;
}
