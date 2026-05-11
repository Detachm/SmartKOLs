import type { Clock } from "../../../../core/time/clock";
import { AppError } from "../../../../core/errors/app-error";
import { requireNonEmptyString } from "../../../../core/validation/guards";
import type {
  AccountAutomationActionPreview,
  AccountAutomationOverviewResponse,
} from "../../../../contracts/api/account-automation";
import type { AccountAutomationOverviewReadModel } from "../ports/account-automation-overview-read-model";
import type { OrchestrationRunsRepository } from "../ports/orchestration-runs-repository";
import type { EligibleOrchestrationAction, OrchestrationDecision } from "../../domain/orchestration-decision";
import { ChiefOrchestrator } from "../services/chief-orchestrator";
import { EvaluateAccountEligibility } from "../services/evaluate-account-eligibility";

export interface GetAccountAutomationOverviewDependencies {
  readModel: AccountAutomationOverviewReadModel;
  runs: OrchestrationRunsRepository;
  eligibility: EvaluateAccountEligibility;
  chief: ChiefOrchestrator;
  clock: Clock;
}

export class GetAccountAutomationOverview {
  constructor(private readonly deps: GetAccountAutomationOverviewDependencies) {}

  async execute(accountId: string): Promise<AccountAutomationOverviewResponse | null> {
    const overview = await this.deps.readModel.getAccountAutomationOverview(requireNonEmptyString(accountId, "account_id"));
    if (!overview) {
      return null;
    }

    const now = this.deps.clock.now().toISOString();
    const recentRuns = await this.deps.runs.listRecentByAccountId(overview.account_id, 8);
    const evaluation = this.deps.eligibility.execute(overview, now);
    const chosenAction = this.deps.chief.decide({
      account_id: overview.account_id,
      eligible_actions: evaluation.eligible_actions,
      blocked_reason_code: evaluation.blocked_reason_code,
      rationale: evaluation.rationale,
    });

    return {
      account_id: overview.account_id,
      workspace_id: overview.workspace_id,
      account_handle: overview.account_handle,
      orchestration_status: overview.state?.status ?? "inactive",
      has_active_automation: overview.has_active_automation,
      next_due_at: overview.next_due_at,
      state: overview.state ? {
        next_tick_after: overview.state.next_tick_after,
        last_tick_at: overview.state.last_tick_at,
        active_run_id: overview.state.active_run_id,
        last_decision_type: overview.state.last_decision_type,
        last_reason_code: overview.state.last_reason_code,
        created_at: overview.state.created_at,
        updated_at: overview.state.updated_at,
      } : undefined,
      pending_draft_count: overview.pending_draft_count,
      pending_manual_review_draft_count: overview.pending_manual_review_draft_count,
      pending_auto_approve_draft_count: overview.pending_auto_approve_draft_count,
      max_pending_manual_review_drafts: overview.max_pending_manual_review_drafts,
      queued_or_running_content_tasks: overview.queued_or_running_content_tasks,
      latest_ready_brief_without_draft: overview.latest_ready_brief_without_draft,
      next_due_recurring_plan: overview.next_due_recurring_plan,
      next_due_autopost_policy: overview.next_due_autopost_policy,
      active_autopost_run: overview.active_autopost_run,
      next_classification_candidate_thread: overview.next_classification_candidate_thread,
      next_reply_candidate_thread: overview.next_reply_candidate_thread,
      engagement_automation: overview.engagement_automation,
      recent_runs: recentRuns.map((run) => {
        const chosenAction = parseActionPreview(run.chosen_action_json, run.id);
        const failureScope = resolveFailureScope(chosenAction);
        return {
          run_id: run.id,
          trigger_kind: run.trigger_kind,
          status: run.status,
          created_at: run.created_at,
          finished_at: run.finished_at,
          chosen_action: chosenAction,
          eligible_actions: parseActionList(run.eligible_actions_json, run.id),
          failure_scope: run.status === "failed" ? failureScope : undefined,
          is_isolated_failure: run.status === "failed" && failureScope === "engagement" ? true : undefined,
          error_code: run.error_code,
          error_message: run.error_message,
        };
      }),
      evaluation: {
        blocked_reason_code: evaluation.blocked_reason_code,
        rationale: evaluation.rationale,
        eligible_actions: evaluation.eligible_actions.map(toActionPreview),
        chosen_action: toDecisionPreview(chosenAction),
      },
    };
  }
}

function resolveFailureScope(
  action: AccountAutomationActionPreview | { type: "no_action" } | undefined,
): "autopost" | "engagement" | "content" | "system" {
  const actionType = action?.type;
  if (!actionType || actionType === "no_action") {
    return "system";
  }

  if (actionType.startsWith("engagement.")) {
    return "engagement";
  }

  if (actionType.startsWith("autopost.")) {
    return "autopost";
  }

  if (actionType === "draft.generate.from_brief" || actionType === "brief.generate.from_recurring_plan") {
    return "content";
  }

  return "system";
}

function toActionPreview(decision: EligibleOrchestrationAction): AccountAutomationActionPreview {
  if (decision.type === "draft.generate.from_brief") {
    return {
      type: decision.type,
      priority_score: decision.priority_score,
      rationale: decision.rationale,
      brief_id: decision.brief_id,
    };
  }

  if (decision.type === "brief.generate.from_recurring_plan") {
    return {
      type: decision.type,
      priority_score: decision.priority_score,
      rationale: decision.rationale,
      plan_id: decision.plan_id,
    };
  }

  if (decision.type === "autopost.execute_policy") {
    return {
      type: decision.type,
      priority_score: decision.priority_score,
      rationale: decision.rationale,
      policy_id: decision.policy_id,
    };
  }

  if (decision.type === "engagement.reply.generate") {
    return {
      type: decision.type,
      priority_score: decision.priority_score,
      rationale: decision.rationale,
      thread_id: decision.thread_id,
    };
  }

  if (decision.type === "engagement.classify") {
    return {
      type: decision.type,
      priority_score: decision.priority_score,
      rationale: decision.rationale,
      thread_id: decision.thread_id,
    };
  }

  if (decision.type === "autopost.generate_draft_from_run") {
    return {
      type: decision.type,
      priority_score: decision.priority_score,
      rationale: decision.rationale,
      run_id: decision.run_id,
      brief_id: decision.brief_id,
    };
  }

  if (decision.type === "engagement.follow.execute" || decision.type === "engagement.repost.execute" || decision.type === "engagement.comment.execute") {
    return {
      type: decision.type,
      priority_score: decision.priority_score,
      rationale: decision.rationale,
    };
  }

  return {
    type: decision.type,
    priority_score: decision.priority_score,
    rationale: decision.rationale,
    run_id: decision.run_id,
    draft_id: decision.draft_id,
  };
}

function toDecisionPreview(decision: OrchestrationDecision) {
  if (decision.type === "no_action") {
    return {
      type: "no_action" as const,
      reason_code: decision.reason_code,
      rationale: decision.rationale,
    };
  }

  return toActionPreview(decision);
}

function parseActionPreview(payload: string | undefined, runId: string) {
  if (!payload) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(payload) as OrchestrationDecision;
    return toDecisionPreview(parsed);
  } catch (cause) {
    throw new AppError("INTERNAL_ERROR", "orchestration run chosen_action_json is invalid", {
      details: { run_id: runId, field: "chosen_action_json" },
      cause,
    });
  }
}

function parseActionList(payload: string, runId: string) {
  try {
    const parsed = JSON.parse(payload) as OrchestrationDecision[];
    if (!Array.isArray(parsed)) {
      throw new AppError("INTERNAL_ERROR", "orchestration run eligible_actions_json must be an array", {
        details: { run_id: runId, field: "eligible_actions_json" },
      });
    }
    return parsed
      .filter((decision): decision is EligibleOrchestrationAction => decision.type !== "no_action")
      .map(toActionPreview);
  } catch (cause) {
    if (cause instanceof AppError) {
      throw cause;
    }

    throw new AppError("INTERNAL_ERROR", "orchestration run eligible_actions_json is invalid", {
      details: { run_id: runId, field: "eligible_actions_json" },
      cause,
    });
  }
}
