import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { GenerateContentBriefResponse } from "../../../../contracts/api/content-briefs";
import type { AgentRuntimeRepository } from "../../../agent-runtime/application/ports/agent-runtime-repository";
import { createAgentTask } from "../../../agent-runtime/domain/agent-task";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { ContentBriefsRepository } from "../ports/content-briefs-repository";
import { parseContentBriefSourceScope } from "../../domain/content-brief-source-scope";
import { requeueContentBrief } from "../../domain/content-brief";

export interface RegenerateContentBriefDependencies {
  runtime: AgentRuntimeRepository;
  contentBriefs: ContentBriefsRepository;
  auditLogs: AuditLogRepository;
  now: () => string;
}

export class RegenerateContentBrief {
  constructor(private readonly deps: RegenerateContentBriefDependencies) {}

  async execute(briefId: string): Promise<GenerateContentBriefResponse> {
    const brief = await this.deps.contentBriefs.findBriefById(briefId);
    if (!brief) {
      throw new AppError("NOT_FOUND", "content brief not found", {
        details: { brief_id: briefId },
      });
    }

    const definition = await this.deps.runtime.findDefinitionByCode("brief-builder");
    if (!definition) {
      throw new AppError("NOT_FOUND", "agent definition brief-builder not found", {
        details: { code: "brief-builder" },
      });
    }

    const sourceScope = parseContentBriefSourceScope(brief.source_scope);
    if (!sourceScope) {
      throw new AppError("INVALID_STATE", "content brief source_scope is required for regeneration", {
        details: { brief_id: brief.id },
      });
    }

    const task = createAgentTask({
      id: newId(),
      workspace_id: brief.workspace_id,
      agent_definition_id: definition.id,
      task_type: "content_brief.generate",
      target_type: "account",
      target_id: brief.account_id,
      payload: JSON.stringify({
        brief_id: brief.id,
      }),
      created_at: this.deps.now(),
    });

    const requeued = requeueContentBrief(brief, task.created_at);
    await this.deps.contentBriefs.saveBrief(requeued);
    await this.deps.contentBriefs.replaceEvidenceItems(requeued.id, []);
    await this.deps.runtime.createTask(task);
    await this.deps.auditLogs.append({
      id: newId(),
      workspace_id: requeued.workspace_id,
      actor_type: "user",
      entity_type: "content_brief",
      entity_id: requeued.id,
      action: "content_brief.regenerate_requested",
      before_state: JSON.stringify(brief),
      after_state: JSON.stringify(requeued),
      created_at: task.created_at,
    });

    return {
      task_id: task.id,
      status: task.status,
      brief_id: requeued.id,
    };
  }
}
