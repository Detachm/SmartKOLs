import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { EngagementRepository } from "../../../engagement/application/ports/engagement-repository";
import type { AgentRuntimeRepository } from "../ports/agent-runtime-repository";
import { createAgentTask } from "../../domain/agent-task";

export interface ClassifyInboxThreadDependencies {
  runtime: AgentRuntimeRepository;
  engagement: EngagementRepository;
  now: () => string;
}

export class ClassifyInboxThread {
  constructor(private readonly deps: ClassifyInboxThreadDependencies) {}

  async execute(threadId: string) {
    const thread = await this.deps.engagement.findThreadById(threadId);
    if (!thread) {
      throw new AppError("NOT_FOUND", "engagement thread not found", {
        details: { thread_id: threadId },
      });
    }

    const definition = await this.deps.runtime.findDefinitionByCode("inbox-classifier");
    if (!definition) {
      throw new AppError("NOT_FOUND", "agent definition inbox-classifier not found", {
        details: { code: "inbox-classifier" },
      });
    }

    const task = createAgentTask({
      id: newId(),
      workspace_id: thread.workspace_id,
      agent_definition_id: definition.id,
      task_type: "inbox.classify",
      target_type: "engagement_thread",
      target_id: thread.id,
      payload: JSON.stringify({ thread_id: thread.id, account_id: thread.account_id }),
      created_at: this.deps.now(),
    });
    await this.deps.runtime.createTask(task);
    return {
      task_id: task.id,
      status: task.status,
    };
  }
}
