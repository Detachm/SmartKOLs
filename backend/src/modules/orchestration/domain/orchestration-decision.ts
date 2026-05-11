import { requireIntegerInRange, requireNonEmptyString, requireOneOf } from "../../../core/validation/guards";

export type OrchestrationDecisionType =
  | "no_action"
  | "draft.generate.from_brief"
  | "brief.generate.from_recurring_plan"
  | "engagement.classify"
  | "engagement.reply.generate"
  | "engagement.follow.execute"
  | "engagement.repost.execute"
  | "engagement.comment.execute"
  | "autopost.execute_policy"
  | "autopost.generate_draft_from_run"
  | "autopost.finalize_run";
export type OrchestrationReasonCode =
  | "automation_inactive"
  | "automation_paused"
  | "content_task_running"
  | "awaiting_draft_review"
  | "awaiting_reply_review"
  | "awaiting_reply_send"
  | "engagement_policy_missing"
  | "engagement_policy_paused"
  | "engagement_policy_blocks_open_threads"
  | "waiting_for_next_due_window"
  | "no_eligible_actions"
  | "tick_failed";

export interface DraftGenerateFromBriefAction {
  type: "draft.generate.from_brief";
  account_id: string;
  brief_id: string;
  rationale: string;
  priority_score: number;
}

export interface BriefGenerateFromRecurringPlanAction {
  type: "brief.generate.from_recurring_plan";
  account_id: string;
  plan_id: string;
  rationale: string;
  priority_score: number;
}

export interface AutopostExecutePolicyAction {
  type: "autopost.execute_policy";
  account_id: string;
  policy_id: string;
  rationale: string;
  priority_score: number;
}

export interface AutopostGenerateDraftFromRunAction {
  type: "autopost.generate_draft_from_run";
  account_id: string;
  run_id: string;
  brief_id: string;
  rationale: string;
  priority_score: number;
}

export interface AutopostFinalizeRunAction {
  type: "autopost.finalize_run";
  account_id: string;
  run_id: string;
  draft_id: string;
  rationale: string;
  priority_score: number;
}

export interface EngagementReplyGenerateAction {
  type: "engagement.reply.generate";
  account_id: string;
  thread_id: string;
  preferred_style?: string;
  rationale: string;
  priority_score: number;
}

export interface EngagementClassifyAction {
  type: "engagement.classify";
  account_id: string;
  thread_id: string;
  rationale: string;
  priority_score: number;
}

export interface EngagementFollowExecuteAction {
  type: "engagement.follow.execute";
  account_id: string;
  rationale: string;
  priority_score: number;
}

export interface EngagementRepostExecuteAction {
  type: "engagement.repost.execute";
  account_id: string;
  rationale: string;
  priority_score: number;
}

export interface EngagementCommentExecuteAction {
  type: "engagement.comment.execute";
  account_id: string;
  rationale: string;
  priority_score: number;
}

export interface NoActionDecision {
  type: "no_action";
  account_id: string;
  reason_code: OrchestrationReasonCode;
  rationale: string;
}

export type EligibleOrchestrationAction =
  | DraftGenerateFromBriefAction
  | BriefGenerateFromRecurringPlanAction
  | EngagementClassifyAction
  | EngagementReplyGenerateAction
  | EngagementFollowExecuteAction
  | EngagementRepostExecuteAction
  | EngagementCommentExecuteAction
  | AutopostExecutePolicyAction
  | AutopostGenerateDraftFromRunAction
  | AutopostFinalizeRunAction;
export type OrchestrationDecision = EligibleOrchestrationAction | NoActionDecision;

export function createDraftGenerateFromBriefAction(input: DraftGenerateFromBriefAction): DraftGenerateFromBriefAction {
  return {
    type: "draft.generate.from_brief",
    account_id: requireNonEmptyString(input.account_id, "account_id"),
    brief_id: requireNonEmptyString(input.brief_id, "brief_id"),
    rationale: requireNonEmptyString(input.rationale, "rationale"),
    priority_score: requireIntegerInRange(input.priority_score, "priority_score", 0, 10_000),
  };
}

export function createBriefGenerateFromRecurringPlanAction(
  input: BriefGenerateFromRecurringPlanAction,
): BriefGenerateFromRecurringPlanAction {
  return {
    type: "brief.generate.from_recurring_plan",
    account_id: requireNonEmptyString(input.account_id, "account_id"),
    plan_id: requireNonEmptyString(input.plan_id, "plan_id"),
    rationale: requireNonEmptyString(input.rationale, "rationale"),
    priority_score: requireIntegerInRange(input.priority_score, "priority_score", 0, 10_000),
  };
}

export function createAutopostExecutePolicyAction(
  input: AutopostExecutePolicyAction,
): AutopostExecutePolicyAction {
  return {
    type: "autopost.execute_policy",
    account_id: requireNonEmptyString(input.account_id, "account_id"),
    policy_id: requireNonEmptyString(input.policy_id, "policy_id"),
    rationale: requireNonEmptyString(input.rationale, "rationale"),
    priority_score: requireIntegerInRange(input.priority_score, "priority_score", 0, 10_000),
  };
}

export function createAutopostGenerateDraftFromRunAction(
  input: AutopostGenerateDraftFromRunAction,
): AutopostGenerateDraftFromRunAction {
  return {
    type: "autopost.generate_draft_from_run",
    account_id: requireNonEmptyString(input.account_id, "account_id"),
    run_id: requireNonEmptyString(input.run_id, "run_id"),
    brief_id: requireNonEmptyString(input.brief_id, "brief_id"),
    rationale: requireNonEmptyString(input.rationale, "rationale"),
    priority_score: requireIntegerInRange(input.priority_score, "priority_score", 0, 10_000),
  };
}

export function createAutopostFinalizeRunAction(
  input: AutopostFinalizeRunAction,
): AutopostFinalizeRunAction {
  return {
    type: "autopost.finalize_run",
    account_id: requireNonEmptyString(input.account_id, "account_id"),
    run_id: requireNonEmptyString(input.run_id, "run_id"),
    draft_id: requireNonEmptyString(input.draft_id, "draft_id"),
    rationale: requireNonEmptyString(input.rationale, "rationale"),
    priority_score: requireIntegerInRange(input.priority_score, "priority_score", 0, 10_000),
  };
}

export function createEngagementReplyGenerateAction(
  input: EngagementReplyGenerateAction,
): EngagementReplyGenerateAction {
  return {
    type: "engagement.reply.generate",
    account_id: requireNonEmptyString(input.account_id, "account_id"),
    thread_id: requireNonEmptyString(input.thread_id, "thread_id"),
    preferred_style: typeof input.preferred_style === "string" && input.preferred_style.trim() !== ""
      ? input.preferred_style.trim()
      : undefined,
    rationale: requireNonEmptyString(input.rationale, "rationale"),
    priority_score: requireIntegerInRange(input.priority_score, "priority_score", 0, 10_000),
  };
}

export function createEngagementClassifyAction(
  input: EngagementClassifyAction,
): EngagementClassifyAction {
  return {
    type: "engagement.classify",
    account_id: requireNonEmptyString(input.account_id, "account_id"),
    thread_id: requireNonEmptyString(input.thread_id, "thread_id"),
    rationale: requireNonEmptyString(input.rationale, "rationale"),
    priority_score: requireIntegerInRange(input.priority_score, "priority_score", 0, 10_000),
  };
}

export function createEngagementFollowExecuteAction(
  input: EngagementFollowExecuteAction,
): EngagementFollowExecuteAction {
  return {
    type: "engagement.follow.execute",
    account_id: requireNonEmptyString(input.account_id, "account_id"),
    rationale: requireNonEmptyString(input.rationale, "rationale"),
    priority_score: requireIntegerInRange(input.priority_score, "priority_score", 0, 10_000),
  };
}

export function createEngagementRepostExecuteAction(
  input: EngagementRepostExecuteAction,
): EngagementRepostExecuteAction {
  return {
    type: "engagement.repost.execute",
    account_id: requireNonEmptyString(input.account_id, "account_id"),
    rationale: requireNonEmptyString(input.rationale, "rationale"),
    priority_score: requireIntegerInRange(input.priority_score, "priority_score", 0, 10_000),
  };
}

export function createEngagementCommentExecuteAction(
  input: EngagementCommentExecuteAction,
): EngagementCommentExecuteAction {
  return {
    type: "engagement.comment.execute",
    account_id: requireNonEmptyString(input.account_id, "account_id"),
    rationale: requireNonEmptyString(input.rationale, "rationale"),
    priority_score: requireIntegerInRange(input.priority_score, "priority_score", 0, 10_000),
  };
}

export function createNoActionDecision(input: NoActionDecision): NoActionDecision {
  return {
    type: "no_action",
    account_id: requireNonEmptyString(input.account_id, "account_id"),
    reason_code: requireOneOf(input.reason_code, "reason_code", [
      "automation_inactive",
      "automation_paused",
      "content_task_running",
      "awaiting_draft_review",
      "awaiting_reply_review",
      "awaiting_reply_send",
      "engagement_policy_missing",
      "engagement_policy_paused",
      "engagement_policy_blocks_open_threads",
      "waiting_for_next_due_window",
      "no_eligible_actions",
      "tick_failed",
    ] as const),
    rationale: requireNonEmptyString(input.rationale, "rationale"),
  };
}
