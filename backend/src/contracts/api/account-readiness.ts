import type { OrchestrationReasonCode } from "../../modules/orchestration/domain/orchestration-decision";

export type AccountReadinessStatus = "ready" | "warning" | "blocked" | "missing";

export interface AccountReadinessCheck {
  status: AccountReadinessStatus;
  detail: string;
}

export interface AccountReadinessResponse {
  account_id: string;
  workspace_id: string;
  overall_status: Exclude<AccountReadinessStatus, "missing">;
  summary: {
    ready_count: number;
    warning_count: number;
    blocked_count: number;
    missing_count: number;
  };
  checks: {
    credential: AccountReadinessCheck & {
      provider?: "x_oauth1" | "x_oauth2" | "api_key";
      credential_status?: "valid" | "invalid" | "expired" | "revoked";
      last_validated_at?: string;
    };
    profile: AccountReadinessCheck & {
      external_account_id?: string;
    };
    persona: AccountReadinessCheck & {
      source?: "manual" | "template" | "distilled" | "generated";
      updated_at?: string;
    };
    sources: AccountReadinessCheck & {
      source_count: number;
      active_source_count: number;
      has_recent_documents: boolean;
      latest_fetched_at?: string;
    };
    autopost: AccountReadinessCheck & {
      policy_status: "not_configured" | "active" | "paused";
      next_run_after?: string;
      last_error_code?: string;
      last_error_message?: string;
    };
    engagement: AccountReadinessCheck & {
      policy_status: "not_configured" | "active" | "paused";
      enabled_features: string[];
      blocked_reason_code?: OrchestrationReasonCode;
    };
  };
  runtime: {
    orchestration_status: "inactive" | "active" | "paused";
    blocked_reason_code?: OrchestrationReasonCode;
    rationale: string;
    next_due_at?: string;
    pending_draft_count?: number;
    pending_manual_review_draft_count?: number;
    pending_auto_approve_draft_count?: number;
    max_pending_manual_review_drafts?: number;
  };
}
