import type { DraftReview } from "../../modules/drafts/domain/draft";
import type { DraftVersion } from "../../modules/drafts/domain/draft-version";
import type { PublishJobResponse, PublishScheduleResponse } from "./schedules";

export interface DraftResponse {
  id: string;
  workspace_id: string;
  account_id: string;
  trend_id?: string;
  current_version_id?: string;
  status: "pending" | "approved" | "rejected" | "scheduled" | "published" | "failed";
  topic: string;
  scheduled_for?: string;
  generated_by_run_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ApproveDraftRequest {
  reviewer_type: "user" | "agent";
  reviewer_id?: string;
  comment?: string;
}

export interface GenerateDraftRequest {
  topic?: string;
  trend_id?: string;
  content_brief_id?: string;
  preview_mode?: boolean;
}

export interface GenerateDraftResponse {
  task_id: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
}

export interface GenerateDraftReviewResponse {
  task_id: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
}

export interface RequestDraftRegenerationRequest {
  reviewer_type: "user" | "agent";
  reviewer_id?: string;
  comment?: string;
}

export interface RequestDraftRegenerationResponse {
  task_id: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
}

export interface DraftDetailResponse {
  draft: DraftResponse;
  current_version?: DraftVersion;
  reviews: DraftReview[];
}

export interface DraftListItem {
  draft: DraftResponse;
  account: {
    id: string;
    workspace_id: string;
    handle: string;
    display_name: string;
    avatar_url?: string;
    status: "active" | "paused" | "disabled" | "error";
  };
  workspace: {
    id: string;
    name: string;
    slug: string;
    status: "active" | "suspended" | "closed";
  };
  current_version?: DraftVersion;
  latest_review?: DraftReview;
  schedule?: PublishScheduleResponse;
  latest_publish_job?: PublishJobResponse;
}

export interface DraftListResponse {
  drafts: DraftListItem[];
}
