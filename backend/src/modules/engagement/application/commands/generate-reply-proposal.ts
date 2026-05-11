import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { AgentRuntimeRepository } from "../../../agent-runtime/application/ports/agent-runtime-repository";
import { createAgentTask } from "../../../agent-runtime/domain/agent-task";
import type { EngagementRepository } from "../ports/engagement-repository";

export interface GenerateReplyProposalDependencies {
  runtime: AgentRuntimeRepository;
  engagement: EngagementRepository;
  now: () => string;
}

export class GenerateReplyProposal {
  constructor(private readonly deps: GenerateReplyProposalDependencies) {}

  async execute(threadId: string, options?: { preferred_style?: string }) {
    const thread = await this.deps.engagement.findThreadById(threadId);
    if (!thread) {
      throw new AppError("NOT_FOUND", "engagement thread not found", {
        details: { thread_id: threadId },
      });
    }

    const existingProposals = await this.deps.engagement.listReplyProposalsByThreadId(thread.id);
    const activeProposal = existingProposals.find((proposal) => proposal.status !== "rejected");
    if (activeProposal) {
      throw new AppError("CONFLICT", "reply proposal already exists for thread", {
        details: {
          thread_id: thread.id,
          proposal_id: activeProposal.id,
          proposal_status: activeProposal.status,
        },
      });
    }

    const definition = await this.deps.runtime.findDefinitionByCode("reply-proposer");
    if (!definition) {
      throw new AppError("NOT_FOUND", "agent definition reply-proposer not found", {
        details: { code: "reply-proposer" },
      });
    }

    const task = createAgentTask({
      id: newId(),
      workspace_id: thread.workspace_id,
      agent_definition_id: definition.id,
      task_type: "engagement.reply_propose",
      target_type: "engagement_thread",
      target_id: thread.id,
      payload: JSON.stringify({
        thread_id: thread.id,
        account_id: thread.account_id,
        preferred_style: options?.preferred_style,
      }),
      created_at: this.deps.now(),
    });
    await this.deps.runtime.createTask(task);

    return {
      task_id: task.id,
      status: task.status,
    };
  }
}
