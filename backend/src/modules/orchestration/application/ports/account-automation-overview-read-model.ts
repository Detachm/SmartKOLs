import type { AccountOrchestrationState } from "../../domain/account-orchestration-state";
import type { ContentBriefGenerationMode } from "../../../content-briefs/domain/content-brief";
import type { RecurringBriefPlanGenerationMode } from "../../../editorial/domain/editorial";
import type { AutopostGenerationMode } from "../../../autopost/domain/autopost-policy";

export interface AccountAutomationOverview {
  account_id: string;
  workspace_id: string;
  state?: AccountOrchestrationState;
  has_active_automation: boolean;
  next_due_at?: string;
  pending_draft_count: number;
  queued_or_running_content_tasks: Array<{
    task_id: string;
    task_type: "content_brief.generate" | "draft.generate";
    status: "queued" | "running";
    created_at: string;
  }>;
  latest_ready_brief_without_draft?: {
    brief_id: string;
    generation_mode: ContentBriefGenerationMode;
    topic?: string;
    updated_at: string;
    created_at: string;
  };
  next_due_recurring_plan?: {
    plan_id: string;
    name: string;
    generation_mode: RecurringBriefPlanGenerationMode;
    next_run_after: string;
    default_topic_hint?: string;
  };
  next_due_autopost_policy?: {
    policy_id: string;
    generation_mode: AutopostGenerationMode;
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
}

export interface AccountAutomationOverviewReadModel {
  getAccountAutomationOverview(accountId: string): Promise<AccountAutomationOverview | null>;
}
