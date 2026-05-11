import type { SqliteExecutor } from "../../../infrastructure/db/sqlite-executor";
import type { PersonaTemplatesRepository } from "../application/ports/persona-templates-repository";
import {
  createPersonaTemplate,
  parsePersonaTemplateBody,
  serializePersonaTemplateBody,
  type PersonaTemplate,
} from "../domain/persona-template";

interface PersonaTemplateRow {
  id: string;
  workspace_id: string | null;
  name: string;
  description: string;
  template_body: string;
  is_active: number;
  created_at: string;
}

function mapRow(row: PersonaTemplateRow): PersonaTemplate {
  return createPersonaTemplate({
    id: row.id,
    workspace_id: row.workspace_id ?? undefined,
    name: row.name,
    description: row.description,
    persona: parsePersonaTemplateBody(row.template_body),
    is_active: row.is_active === 1,
    created_at: row.created_at,
  });
}

export class SqlitePersonaTemplatesRepository implements PersonaTemplatesRepository {
  constructor(private readonly db: SqliteExecutor) {}

  async findById(templateId: string): Promise<PersonaTemplate | null> {
    const row = this.db.get<PersonaTemplateRow>(
      `SELECT
        id, workspace_id, name, description, template_body, is_active, created_at
      FROM persona_templates
      WHERE id = ?`,
      [templateId],
    );

    return row ? mapRow(row) : null;
  }

  async findByScopeAndName(workspaceId: string | undefined, name: string): Promise<PersonaTemplate | null> {
    const row = workspaceId
      ? this.db.get<PersonaTemplateRow>(
        `SELECT
          id, workspace_id, name, description, template_body, is_active, created_at
        FROM persona_templates
        WHERE workspace_id = ? AND name = ?`,
        [workspaceId, name],
      )
      : this.db.get<PersonaTemplateRow>(
        `SELECT
          id, workspace_id, name, description, template_body, is_active, created_at
        FROM persona_templates
        WHERE workspace_id IS NULL AND name = ?`,
        [name],
      );

    return row ? mapRow(row) : null;
  }

  async listAvailableByWorkspaceId(workspaceId: string): Promise<PersonaTemplate[]> {
    return this.db.all<PersonaTemplateRow>(
      `SELECT
        id, workspace_id, name, description, template_body, is_active, created_at
      FROM persona_templates
      WHERE is_active = 1
        AND (workspace_id IS NULL OR workspace_id = ?)
      ORDER BY
        CASE WHEN workspace_id IS NULL THEN 0 ELSE 1 END DESC,
        created_at DESC,
        id DESC`,
      [workspaceId],
    ).map(mapRow);
  }

  async save(template: PersonaTemplate): Promise<void> {
    const normalized = createPersonaTemplate(template);
    this.db.run(
      `INSERT INTO persona_templates (
        id, workspace_id, name, description, template_body, is_active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        workspace_id = excluded.workspace_id,
        name = excluded.name,
        description = excluded.description,
        template_body = excluded.template_body,
        is_active = excluded.is_active`,
      [
        normalized.id,
        normalized.workspace_id ?? null,
        normalized.name,
        normalized.description,
        serializePersonaTemplateBody(normalized.persona),
        normalized.is_active ? 1 : 0,
        normalized.created_at,
      ],
    );
  }
}
