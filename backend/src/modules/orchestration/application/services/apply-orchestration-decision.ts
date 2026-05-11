import type { ContinueAutopostRunFromBrief } from "../../../autopost/application/commands/continue-autopost-run-from-brief";
import type { ExecuteAutopostPolicy } from "../../../autopost/application/commands/execute-autopost-policy";
import type { FinalizeAutopostRun } from "../../../autopost/application/commands/finalize-autopost-run";
import type { ClassifyInboxThread } from "../../../agent-runtime/application/commands/classify-inbox-thread";
import type { GenerateDraft } from "../../../drafts/application/commands/generate-draft";
import type { ExecuteRecurringBriefPlan } from "../../../editorial/application/commands/execute-recurring-brief-plan";
import type { ExecuteAutoComment } from "../../../engagement/application/commands/execute-auto-comment";
import type { ExecuteAutoFollow } from "../../../engagement/application/commands/execute-auto-follow";
import type { ExecuteAutoRepost } from "../../../engagement/application/commands/execute-auto-repost";
import type { GenerateReplyProposal } from "../../../engagement/application/commands/generate-reply-proposal";
import type { OrchestrationDecision } from "../../domain/orchestration-decision";

export interface ApplyOrchestrationDecisionDependencies {
  classifyInboxThread: ClassifyInboxThread;
  continueAutopostRunFromBrief: ContinueAutopostRunFromBrief;
  executeAutopostPolicy: ExecuteAutopostPolicy;
  finalizeAutopostRun: FinalizeAutopostRun;
  generateDraft: GenerateDraft;
  executeRecurringBriefPlan: ExecuteRecurringBriefPlan;
  executeAutoComment: ExecuteAutoComment;
  executeAutoFollow: ExecuteAutoFollow;
  executeAutoRepost: ExecuteAutoRepost;
  generateReplyProposal: GenerateReplyProposal;
}

export class ApplyOrchestrationDecision {
  constructor(private readonly deps: ApplyOrchestrationDecisionDependencies) {}

  async execute(decision: OrchestrationDecision) {
    if (decision.type === "no_action") {
      return {
        decision,
      };
    }

    if (decision.type === "brief.generate.from_recurring_plan") {
      const result = await this.deps.executeRecurringBriefPlan.execute(decision.plan_id);
      return {
        decision,
        execution: {
          entity_type: "agent_task",
          entity_id: result.task_id,
          status: "queued" as const,
          brief_id: result.brief_id,
        },
      };
    }

    if (decision.type === "autopost.execute_policy") {
      const result = await this.deps.executeAutopostPolicy.execute({
        policy_id: decision.policy_id,
        trigger: "scheduled",
      });
      return {
        decision,
        execution: {
          entity_type: "autopost_run",
          entity_id: result.run.id,
          status: result.run.status,
          task_id: result.task_id,
        },
      };
    }

    if (decision.type === "autopost.generate_draft_from_run") {
      const result = await this.deps.continueAutopostRunFromBrief.execute(decision.run_id);
      return {
        decision,
        execution: {
          entity_type: "agent_task",
          entity_id: result.task_id,
          status: result.status,
          run_id: result.run.id,
        },
      };
    }

    if (decision.type === "autopost.finalize_run") {
      const result = await this.deps.finalizeAutopostRun.execute(decision.run_id);
      return {
        decision,
        execution: {
          entity_type: "autopost_run",
          entity_id: result.run.id,
          status: result.run.status,
        },
      };
    }

    if (decision.type === "engagement.classify") {
      const result = await this.deps.classifyInboxThread.execute(decision.thread_id);
      return {
        decision,
        execution: {
          entity_type: "agent_task",
          entity_id: result.task_id,
          status: result.status,
          thread_id: decision.thread_id,
        },
      };
    }

    if (decision.type === "engagement.reply.generate") {
      const result = await this.deps.generateReplyProposal.execute(decision.thread_id, {
        preferred_style: decision.preferred_style,
      });
      return {
        decision,
        execution: {
          entity_type: "agent_task",
          entity_id: result.task_id,
          status: result.status,
          thread_id: decision.thread_id,
        },
      };
    }

    if (decision.type === "engagement.comment.execute") {
      const result = await this.deps.executeAutoComment.execute(decision.account_id);
      return { decision, execution: result };
    }

    if (decision.type === "engagement.repost.execute") {
      const result = await this.deps.executeAutoRepost.execute(decision.account_id);
      return { decision, execution: result };
    }

    if (decision.type === "engagement.follow.execute") {
      const result = await this.deps.executeAutoFollow.execute(decision.account_id);
      return { decision, execution: result };
    }

    const result = await this.deps.generateDraft.execute({
      account_id: decision.account_id,
      content_brief_id: decision.brief_id,
    });

    return {
      decision,
      execution: {
        entity_type: "agent_task",
        entity_id: result.task_id,
        status: result.status,
      },
    };
  }
}
