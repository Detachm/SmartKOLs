import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { AgentRuntimeRepository } from "../../../agent-runtime/application/ports/agent-runtime-repository";
import { createAgentTask } from "../../../agent-runtime/domain/agent-task";
import type { DraftsRepository } from "../ports/drafts-repository";

export interface GenerateDraftReviewDependencies {
  runtime: AgentRuntimeRepository;
  drafts: DraftsRepository;
  now: () => string;
}

export class GenerateDraftReview {
  constructor(private readonly deps: GenerateDraftReviewDependencies) {}

  async execute(draftId: string) {
    const draft = await this.deps.drafts.findById(draftId);
    if (!draft) {
      throw new AppError("NOT_FOUND", "draft not found", {
        details: { draft_id: draftId },
      });
    }

    const definition = await this.deps.runtime.findDefinitionByCode("reviewer");
    if (!definition) {
      throw new AppError("NOT_FOUND", "agent definition reviewer not found", {
        details: { code: "reviewer" },
      });
    }

    const task = createAgentTask({
      id: newId(),
      workspace_id: draft.workspace_id,
      agent_definition_id: definition.id,
      task_type: "draft.review",
      target_type: "draft",
      target_id: draft.id,
      payload: JSON.stringify({ draft_id: draft.id }),
      created_at: this.deps.now(),
    });
    await this.deps.runtime.createTask(task);

    return {
      task_id: task.id,
      status: task.status,
    };
  }
}
