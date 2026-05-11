import type { PersonaTemplateListResponse } from "../../../../contracts/api/persona-templates";
import { AppError } from "../../../../core/errors/app-error";
import type { WorkspacesRepository } from "../../../workspaces/application/ports/workspaces-repository";
import type { PersonaTemplatesRepository } from "../ports/persona-templates-repository";

export interface ListPersonaTemplatesDependencies {
  templates: PersonaTemplatesRepository;
  workspaces: WorkspacesRepository;
}

export class ListPersonaTemplates {
  constructor(private readonly deps: ListPersonaTemplatesDependencies) {}

  async execute(input: { workspace_id: string }): Promise<PersonaTemplateListResponse> {
    const workspace = await this.deps.workspaces.findById(input.workspace_id);
    if (!workspace) {
      throw new AppError("NOT_FOUND", "workspace not found", {
        details: { workspace_id: input.workspace_id },
      });
    }

    const templates = await this.deps.templates.listAvailableByWorkspaceId(workspace.id);
    return {
      templates: templates.map((template) => ({
        ...template,
        scope: template.workspace_id ? "workspace" : "global",
      })),
    };
  }
}
