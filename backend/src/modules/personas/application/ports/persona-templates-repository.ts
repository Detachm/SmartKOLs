import type { PersonaTemplate } from "../../domain/persona-template";

export interface PersonaTemplatesRepository {
  findById(templateId: string): Promise<PersonaTemplate | null>;
  findByScopeAndName(workspaceId: string | undefined, name: string): Promise<PersonaTemplate | null>;
  listAvailableByWorkspaceId(workspaceId: string): Promise<PersonaTemplate[]>;
  save(template: PersonaTemplate): Promise<void>;
}
