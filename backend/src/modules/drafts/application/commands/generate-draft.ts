import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { AgentRuntimeRepository } from "../../../agent-runtime/application/ports/agent-runtime-repository";
import { createAgentTask } from "../../../agent-runtime/domain/agent-task";
import type { AccountsRepository } from "../../../accounts/application/ports/accounts-repository";
import type { AutopostAutomationContext } from "../../../autopost/domain/autopost-automation-context";
import type { QueueAccountAutomationTick } from "../../../orchestration/application/commands/queue-account-automation-tick";

export interface GenerateDraftDependencies {
  runtime: AgentRuntimeRepository;
  accounts: AccountsRepository;
  queueAccountAutomationTick: QueueAccountAutomationTick;
  now: () => string;
}

export class GenerateDraft {
  constructor(private readonly deps: GenerateDraftDependencies) {}

  async execute(input: {
    account_id: string;
    topic?: string;
    trend_id?: string;
    content_brief_id?: string;
    automation?: AutopostAutomationContext;
  }) {
    const account = await this.deps.accounts.findById(input.account_id);
    if (!account) {
      throw new AppError("NOT_FOUND", "account not found", {
        details: { account_id: input.account_id },
      });
    }

    const definition = await this.deps.runtime.findDefinitionByCode("writer");
    if (!definition) {
      throw new AppError("NOT_FOUND", "agent definition writer not found", {
        details: { code: "writer" },
      });
    }

    const topic = typeof input.topic === "string" ? input.topic.trim() : "";
    const contentBriefId = typeof input.content_brief_id === "string" ? input.content_brief_id.trim() : "";
    if (!topic && !contentBriefId) {
      throw new AppError("VALIDATION_ERROR", "topic or content_brief_id is required", {
        details: { account_id: input.account_id },
      });
    }

    const task = createAgentTask({
      id: newId(),
      workspace_id: account.workspace_id,
      agent_definition_id: definition.id,
      task_type: "draft.generate",
      target_type: "account",
      target_id: account.id,
      payload: JSON.stringify({
        account_id: account.id,
        topic: topic || undefined,
        trend_id: input.trend_id,
        content_brief_id: contentBriefId || undefined,
        automation: input.automation,
      }),
      created_at: this.deps.now(),
    });
    await this.deps.runtime.createTask(task);
    await this.deps.queueAccountAutomationTick.execute({
      account_id: account.id,
      trigger_kind: "system",
      create_if_missing: true,
    });

    return {
      task_id: task.id,
      status: task.status,
    };
  }
}
