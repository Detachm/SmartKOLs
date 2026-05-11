import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { CreatePersonaTemplateRequest, PersonaTemplateResponse } from "../../../../contracts/api/persona-templates";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { WorkspacesRepository } from "../../../workspaces/application/ports/workspaces-repository";
import { createPersonaTemplate } from "../../domain/persona-template";
import type { PersonaTemplatesRepository } from "../ports/persona-templates-repository";

export interface CreatePersonaTemplateDependencies {
  workspaces: WorkspacesRepository;
  templates: PersonaTemplatesRepository;
  auditLogs: AuditLogRepository;
  clock: Clock;
}

export class CreatePersonaTemplate {
  constructor(private readonly deps: CreatePersonaTemplateDependencies) {}

  async execute(input: CreatePersonaTemplateRequest): Promise<PersonaTemplateResponse> {
    const workspace = await this.deps.workspaces.findById(input.workspace_id);
    if (!workspace) {
      throw new AppError("NOT_FOUND", "workspace not found", {
        details: { workspace_id: input.workspace_id },
      });
    }

    const existing = await this.deps.templates.findByScopeAndName(workspace.id, input.name);
    if (existing) {
      throw new AppError("CONFLICT", "persona template name already exists in workspace", {
        details: { workspace_id: workspace.id, name: input.name },
      });
    }

    const now = this.deps.clock.now().toISOString();
    const template = createPersonaTemplate({
      id: newId(),
      workspace_id: workspace.id,
      name: input.name,
      description: input.description,
      persona: input.persona,
      is_active: true,
      created_at: now,
    });

    await this.deps.templates.save(template);
    await this.deps.auditLogs.append({
      id: newId(),
      workspace_id: workspace.id,
      actor_type: "system",
      entity_type: "persona_template",
      entity_id: template.id,
      action: "persona_template.created",
      after_state: JSON.stringify(template),
      created_at: now,
    });

    return {
      ...template,
      scope: "workspace",
    };
  }
}
