export interface ScheduleDraftRequest {
  scheduled_for: string;
}

export interface UpdatePublishScheduleRequest {
  scheduled_for: string;
}

export interface PublishScheduleResponse {
  id: string;
  workspace_id: string;
  account_id: string;
  draft_id: string;
  scheduled_for: string;
  status: "scheduled" | "queued" | "published" | "failed" | "cancelled";
  created_at: string;
}

export interface PublishJobResponse {
  id: string;
  schedule_id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  idempotency_key: string;
  error_code?: string;
  error_message?: string;
  run_after: string;
  started_at?: string;
  finished_at?: string;
}

export interface ScheduleCalendarItem {
  schedule: PublishScheduleResponse;
  draft: {
    id: string;
    workspace_id: string;
    account_id: string;
    current_version_id?: string;
    status: "pending" | "approved" | "rejected" | "scheduled" | "published" | "failed";
    topic: string;
    created_at: string;
    updated_at: string;
  };
  current_version?: {
    id: string;
    draft_id: string;
    version_no: number;
    content: string;
    metadata: string;
    created_by_type: "user" | "agent" | "system";
    created_by_id?: string;
    created_at: string;
  };
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
  latest_job?: PublishJobResponse;
}

export interface ScheduleRangeResponse {
  schedules: ScheduleCalendarItem[];
}
