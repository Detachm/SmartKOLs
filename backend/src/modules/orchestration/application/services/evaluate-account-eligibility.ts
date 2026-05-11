import {
  createAutopostExecutePolicyAction,
  createAutopostFinalizeRunAction,
  createAutopostGenerateDraftFromRunAction,
  createBriefGenerateFromRecurringPlanAction,
  createEngagementCommentExecuteAction,
  createDraftGenerateFromBriefAction,
  createEngagementClassifyAction,
  createEngagementFollowExecuteAction,
  createEngagementRepostExecuteAction,
  createEngagementReplyGenerateAction,
  type EligibleOrchestrationAction,
  type OrchestrationReasonCode,
} from "../../domain/orchestration-decision";
import { evaluateEngagementAutomationTargets } from "../../../engagement/application/engagement-policy-validation";
import { DEFAULT_MAX_PENDING_MANUAL_REVIEW_DRAFTS } from "../../../autopost/domain/autopost-policy";
import type { AccountAutomationOverview } from "../ports/account-automation-overview-read-model";

export interface AccountEligibilityEvaluation {
  eligible_actions: EligibleOrchestrationAction[];
  blocked_reason_code?: OrchestrationReasonCode;
  rationale: string;
}

export class EvaluateAccountEligibility {
  execute(overview: AccountAutomationOverview, now: string): AccountEligibilityEvaluation {
    const pendingManualReviewDraftCount = getPendingManualReviewDraftCount(overview);
    const maxPendingManualReviewDrafts = getMaxPendingManualReviewDrafts(overview);

    if (overview.state?.status === "paused") {
      return {
        eligible_actions: [],
        blocked_reason_code: "automation_paused",
        rationale: "account orchestration is paused",
      };
    }

    if (overview.queued_or_running_content_tasks.length > 0) {
      return {
        eligible_actions: [],
        blocked_reason_code: "content_task_running",
        rationale: "content generation task is already queued or running for the account",
      };
    }

    const autopostContinuationActions = resolveAutopostContinuationActions(overview);
    if (autopostContinuationActions.length > 0) {
      return {
        eligible_actions: autopostContinuationActions,
        rationale: "autopost run has a ready continuation step",
      };
    }

    const eligibleActions: EligibleOrchestrationAction[] = [];
    const hasManualReviewDraftCapacity = pendingManualReviewDraftCount < maxPendingManualReviewDrafts;
    if (hasManualReviewDraftCapacity && overview.latest_ready_brief_without_draft) {
      eligibleActions.push(createDraftGenerateFromBriefAction({
        type: "draft.generate.from_brief",
        account_id: overview.account_id,
        brief_id: overview.latest_ready_brief_without_draft.brief_id,
        rationale: `latest ready brief has no draft yet and manual-review draft backlog is ${pendingManualReviewDraftCount}/${maxPendingManualReviewDrafts}`,
        priority_score: 200,
      }));
    }

    if (
      overview.next_due_autopost_policy
      && overview.next_due_autopost_policy.next_run_after <= now
      && canStartAutopostPolicy(overview.next_due_autopost_policy, hasManualReviewDraftCapacity)
    ) {
      eligibleActions.push(createAutopostExecutePolicyAction({
        type: "autopost.execute_policy",
        account_id: overview.account_id,
        policy_id: overview.next_due_autopost_policy.policy_id,
        rationale: "autopost policy is due and the account can start a new autopost run",
        priority_score: 150,
      }));
    }

    if (
      hasManualReviewDraftCapacity
      &&
      overview.next_due_recurring_plan
      && overview.next_due_recurring_plan.next_run_after <= now
    ) {
      eligibleActions.push(createBriefGenerateFromRecurringPlanAction({
        type: "brief.generate.from_recurring_plan",
        account_id: overview.account_id,
        plan_id: overview.next_due_recurring_plan.plan_id,
        rationale: "recurring brief plan is due and the account is ready to start a new brief generation run",
        priority_score: 100,
      }));
    }

    if (overview.next_classification_candidate_thread) {
      eligibleActions.push(createEngagementClassifyAction({
        type: "engagement.classify",
        account_id: overview.account_id,
        thread_id: overview.next_classification_candidate_thread.thread_id,
        rationale: "an open engagement thread is ready for inbox classification before downstream reply decisions",
        priority_score: 90,
      }));
    }

    if (overview.next_reply_candidate_thread) {
      const autoReply = overview.engagement_automation.policy_body?.auto_reply;
      if (autoReply?.enabled) {
        const withinReplyQuota = overview.engagement_automation.today_reply_count < autoReply.max_per_day;
        eligibleActions.push(createEngagementReplyGenerateAction({
          type: "engagement.reply.generate",
          account_id: overview.account_id,
          thread_id: overview.next_reply_candidate_thread.thread_id,
          preferred_style: autoReply.style,
          rationale: "an open engagement thread has no reply proposal yet and is ready for agent drafting",
          priority_score: withinReplyQuota ? 80 : 0,
        }));
      }
    }

    const policy = overview.engagement_automation.policy_body;
    const engagementValidation = policy
      ? evaluateEngagementAutomationTargets(policy, overview.account_handle ?? "")
      : undefined;
    const autoComment = policy?.auto_comment;
    if (
      autoComment?.enabled
      && engagementValidation?.valid_features.includes("auto_comment")
      && overview.engagement_automation.today_comment_count < autoComment.max_per_day
    ) {
      eligibleActions.push(createEngagementCommentExecuteAction({
        type: "engagement.comment.execute",
        account_id: overview.account_id,
        rationale: "engagement automation has comment capacity and comment automation is enabled",
        priority_score: 70,
      }));
    }

    const autoRetweet = policy?.auto_retweet;
    if (
      autoRetweet?.enabled
      && engagementValidation?.valid_features.includes("auto_retweet")
      && overview.engagement_automation.today_repost_count < autoRetweet.max_per_day
    ) {
      eligibleActions.push(createEngagementRepostExecuteAction({
        type: "engagement.repost.execute",
        account_id: overview.account_id,
        rationale: "engagement automation has repost capacity and repost automation is enabled",
        priority_score: 60,
      }));
    }

    const autoFollow = policy?.auto_follow;
    if (
      autoFollow?.enabled
      && engagementValidation?.valid_features.includes("auto_follow")
      && overview.engagement_automation.today_follow_count < autoFollow.max_per_day
    ) {
      eligibleActions.push(createEngagementFollowExecuteAction({
        type: "engagement.follow.execute",
        account_id: overview.account_id,
        rationale: "engagement automation has follow capacity and follow automation is enabled",
        priority_score: 50,
      }));
    }

    const filteredEligibleActions = rebalanceRecurringEngagementActions(
      eligibleActions.filter((action) => action.priority_score > 0),
      overview.state?.last_decision_type,
    );

    if (filteredEligibleActions.length > 0) {
      return {
        eligible_actions: filteredEligibleActions,
        rationale: "account has eligible orchestration actions",
      };
    }

    return {
      eligible_actions: [],
      blocked_reason_code: overview.has_active_automation || overview.state
        ? resolveBlockedReason(overview, now)
        : "automation_inactive",
      rationale: overview.has_active_automation || overview.state
        ? resolveBlockedRationale(overview, now)
        : "account has not entered orchestration yet",
    };
  }
}

function rebalanceRecurringEngagementActions(
  actions: EligibleOrchestrationAction[],
  lastDecisionType: string | undefined,
): EligibleOrchestrationAction[] {
  const recurringSequence: Array<EligibleOrchestrationAction["type"]> = [
    "engagement.comment.execute",
    "engagement.repost.execute",
    "engagement.follow.execute",
  ];
  const recurringTypes = new Set<EligibleOrchestrationAction["type"]>(recurringSequence);

  if (!lastDecisionType || !recurringTypes.has(lastDecisionType as EligibleOrchestrationAction["type"])) {
    return actions;
  }

  const recurringActions = actions.filter((action) => recurringTypes.has(action.type));
  if (recurringActions.length <= 1) {
    return actions;
  }

  const highestRecurringPriority = recurringActions.reduce((highest, action) => Math.max(highest, action.priority_score), 0);
  const lastIndex = recurringSequence.indexOf(lastDecisionType as EligibleOrchestrationAction["type"]);
  const preferredNextType = recurringSequence
    .slice(lastIndex + 1)
    .concat(recurringSequence.slice(0, lastIndex + 1))
    .find((type) => recurringActions.some((action) => action.type === type && action.type !== lastDecisionType));

  return actions.map((action) => {
    if (action.type === preferredNextType) {
      return {
        ...action,
        priority_score: highestRecurringPriority + 1,
      };
    }

    return action;
  });
}

function resolveAutopostContinuationActions(overview: AccountAutomationOverview): EligibleOrchestrationAction[] {
  const run = overview.active_autopost_run;
  if (!run) {
    return [];
  }

  if (run.status === "brief_generating" && run.brief_task_status === "succeeded" && run.brief_id) {
    return [createAutopostGenerateDraftFromRunAction({
      type: "autopost.generate_draft_from_run",
      account_id: overview.account_id,
      run_id: run.run_id,
      brief_id: run.brief_id,
      rationale: "autopost brief task has completed and the run is ready to queue draft generation",
      priority_score: 400,
    })];
  }

  if (run.status === "draft_generating" && run.draft_task_status === "succeeded" && run.draft_id) {
    return [createAutopostFinalizeRunAction({
      type: "autopost.finalize_run",
      account_id: overview.account_id,
      run_id: run.run_id,
      draft_id: run.draft_id,
      rationale: "autopost draft task has completed and the run is ready for review or scheduling",
      priority_score: 350,
    })];
  }

  return [];
}

function resolveBlockedReason(overview: AccountAutomationOverview, now: string): OrchestrationReasonCode {
  if (isManualDraftReviewBacklogBlocking(overview, now)) {
    return "awaiting_draft_review";
  }

  if (overview.engagement_automation.pending_review_reply_count > 0) {
    return "awaiting_reply_review";
  }

  if (overview.engagement_automation.approved_reply_pending_send_count > 0) {
    return "awaiting_reply_send";
  }

  if (overview.engagement_automation.open_thread_count > 0) {
    if (overview.engagement_automation.policy_status === "not_configured") {
      return "engagement_policy_missing";
    }

    if (overview.engagement_automation.policy_status === "paused") {
      return "engagement_policy_paused";
    }

    if (overview.engagement_automation.policy_blocked_open_thread_count >= overview.engagement_automation.open_thread_count) {
      return "engagement_policy_blocks_open_threads";
    }
  }

  if (overview.next_due_at && overview.next_due_at > now) {
    return "waiting_for_next_due_window";
  }

  return "no_eligible_actions";
}

function resolveBlockedRationale(overview: AccountAutomationOverview, now: string): string {
  if (isManualDraftReviewBacklogBlocking(overview, now)) {
    return `pending manual-review drafts are ${getPendingManualReviewDraftCount(overview)}/${getMaxPendingManualReviewDrafts(overview)}, so new manual-review content work is paused until the backlog drops`;
  }

  if (overview.engagement_automation.pending_review_reply_count > 0) {
    return "reply proposals are waiting for manual review before engagement automation can continue";
  }

  if (overview.engagement_automation.approved_reply_pending_send_count > 0) {
    return "approved reply proposals are waiting to be sent before engagement automation can progress further";
  }

  if (overview.engagement_automation.open_thread_count > 0) {
    if (overview.engagement_automation.policy_status === "not_configured") {
      return "open engagement threads exist, but engagement automation is blocked because no engagement policy is configured";
    }

    if (overview.engagement_automation.policy_status === "paused") {
      return "open engagement threads exist, but engagement automation is paused by policy";
    }

    if (overview.engagement_automation.policy_blocked_open_thread_count >= overview.engagement_automation.open_thread_count) {
      return "open engagement threads exist, but current engagement policy blocks every available thread";
    }
  }

  if (overview.next_due_at && overview.next_due_at > now) {
    return "automation is configured, but the next scheduled window has not arrived yet";
  }

  return "no eligible orchestration action is currently available";
}

function canStartAutopostPolicy(
  policy: NonNullable<AccountAutomationOverview["next_due_autopost_policy"]>,
  hasManualReviewDraftCapacity: boolean,
) {
  if (policy.draft_review_mode === "auto_approve") {
    return true;
  }

  return hasManualReviewDraftCapacity;
}

function isManualDraftReviewBacklogBlocking(overview: AccountAutomationOverview, now: string) {
  if (getPendingManualReviewDraftCount(overview) < getMaxPendingManualReviewDrafts(overview)) {
    return false;
  }

  if (overview.latest_ready_brief_without_draft) {
    return true;
  }

  if (overview.next_due_recurring_plan && overview.next_due_recurring_plan.next_run_after <= now) {
    return true;
  }

  return Boolean(
    overview.next_due_autopost_policy
    && overview.next_due_autopost_policy.next_run_after <= now
    && overview.next_due_autopost_policy.draft_review_mode === "manual",
  );
}

function getPendingManualReviewDraftCount(overview: AccountAutomationOverview) {
  return overview.pending_manual_review_draft_count ?? overview.pending_draft_count;
}

function getMaxPendingManualReviewDrafts(overview: AccountAutomationOverview) {
  return overview.next_due_autopost_policy?.max_pending_manual_review_drafts
    ?? overview.max_pending_manual_review_drafts
    ?? DEFAULT_MAX_PENDING_MANUAL_REVIEW_DRAFTS;
}
