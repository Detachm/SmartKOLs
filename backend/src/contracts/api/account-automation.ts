import type { OrchestrationDecisionType, OrchestrationReasonCode } from "../../modules/orchestration/domain/orchestration-decision";

export interface AccountAutomationActionPreview {
  type: Exclude<OrchestrationDecisionType, "no_action">;
  priority_score: number;
  rationale: string;
  brief_id?: string;
  plan_id?: string;
  policy_id?: string;
  draft_id?: string;
  run_id?: string;
  thread_id?: string;
}

export interface AccountAutomationNoActionPreview {
  type: "no_action";
  reason_code: OrchestrationReasonCode;
  rationale: string;
}

export interface AccountAutomationOverviewResponse {
  account_id: string;
  workspace_id: string;
  orchestration_status: "inactive" | "active" | "paused";
  has_active_automation: boolean;
  next_due_at?: string;
  state?: {
    next_tick_after?: string;
    last_tick_at?: string;
    active_run_id?: string;
    last_decision_type?: string;
    last_reason_code?: string;
    created_at: string;
    updated_at: string;
  };
  pending_draft_count: number;
  queued_or_running_content_tasks: Array<{
    task_id: string;
    task_type: "content_brief.generate" | "draft.generate";
    status: "queued" | "running";
    created_at: string;
  }>;
  latest_ready_brief_without_draft?: {
    brief_id: string;
    generation_mode: "from_trend" | "from_documents" | "from_source_scope";
    topic?: string;
    updated_at: string;
    created_at: string;
  };
  next_due_recurring_plan?: {
    plan_id: string;
    name: string;
    generation_mode: "from_trend" | "from_source_scope";
    next_run_after: string;
    default_topic_hint?: string;
  };
  next_due_autopost_policy?: {
    policy_id: string;
    generation_mode: "from_trend" | "from_source_scope";
    next_run_after: string;
    draft_review_mode: "manual" | "auto_approve";
    auto_queue_publish: boolean;
  };
  active_autopost_run?: {
    run_id: string;
    policy_id: string;
    status: "queued" | "brief_generating" | "draft_generating";
    scheduled_for: string;
    brief_id?: string;
    brief_task_id?: string;
    brief_task_status?: "queued" | "running" | "succeeded" | "failed" | "cancelled";
    draft_id?: string;
    draft_task_id?: string;
    draft_task_status?: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  };
  next_classification_candidate_thread?: {
    thread_id: string;
    channel: "mention" | "reply" | "dm" | "comment";
    classification: "collab" | "commerce" | "spam" | "normal" | "support";
    status: "open" | "pending_action" | "closed" | "ignored";
    last_message_at: string;
  };
  next_reply_candidate_thread?: {
    thread_id: string;
    channel: "mention" | "reply" | "dm" | "comment";
    classification: "collab" | "commerce" | "spam" | "normal" | "support";
    status: "open" | "pending_action" | "closed" | "ignored";
    last_message_at: string;
  };
  engagement_automation: {
    policy_status: "not_configured" | "active" | "paused";
    open_thread_count: number;
    policy_blocked_open_thread_count: number;
    pending_review_reply_count: number;
    approved_reply_pending_send_count: number;
    next_pending_review_reply?: {
      proposal_id: string;
      thread_id: string;
      created_at: string;
    };
    next_approved_reply_pending_send?: {
      proposal_id: string;
      thread_id: string;
      reviewed_at?: string;
      created_at: string;
    };
  };
  recent_runs: Array<{
    run_id: string;
    trigger_kind: "manual" | "content_task_follow_up" | "draft_review_follow_up" | "system";
    status: "running" | "succeeded" | "failed";
    created_at: string;
    finished_at?: string;
    chosen_action?: AccountAutomationActionPreview | AccountAutomationNoActionPreview;
    eligible_actions: AccountAutomationActionPreview[];
    error_code?: string;
    error_message?: string;
  }>;
  evaluation: {
    blocked_reason_code?: OrchestrationReasonCode;
    rationale: string;
    eligible_actions: AccountAutomationActionPreview[];
    chosen_action: AccountAutomationActionPreview | AccountAutomationNoActionPreview;
  };
}

export interface QueueAccountAutomationTickResponse {
  job_id: string;
  status: "queued";
  run_after: string;
}

export interface UpdateAccountAutomationStateResponse {
  account_id: string;
  orchestration_status: "active" | "paused";
  updated_at: string;
}
