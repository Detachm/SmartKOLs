import type { SqliteExecutor } from "../../../infrastructure/db/sqlite-executor";
import type { WorkspacesRepository } from "../application/ports/workspaces-repository";
import type { Workspace } from "../domain/workspace";

export class SqliteWorkspacesRepository implements WorkspacesRepository {
  constructor(private readonly db: SqliteExecutor) {}

  async findById(workspaceId: string): Promise<Workspace | null> {
    return this.db.get<Workspace>(
      `SELECT id, name, slug, status, created_at, updated_at
      FROM workspaces
      WHERE id = ?`,
      [workspaceId],
    );
  }

  async findBySlug(slug: string): Promise<Workspace | null> {
    return this.db.get<Workspace>(
      `SELECT id, name, slug, status, created_at, updated_at
      FROM workspaces
      WHERE slug = ?`,
      [slug],
    );
  }

  async listAll(): Promise<Workspace[]> {
    return this.db.all<Workspace>(
      `SELECT id, name, slug, status, created_at, updated_at
      FROM workspaces
      ORDER BY created_at DESC`,
    );
  }

  async create(workspace: Workspace): Promise<void> {
    this.db.run(
      `INSERT INTO workspaces (
        id, name, slug, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        workspace.id,
        workspace.name,
        workspace.slug,
        workspace.status,
        workspace.created_at,
        workspace.updated_at,
      ],
    );
  }

  async save(workspace: Workspace): Promise<void> {
    this.db.run(
      `UPDATE workspaces
      SET name = ?, slug = ?, status = ?, updated_at = ?
      WHERE id = ?`,
      [
        workspace.name,
        workspace.slug,
        workspace.status,
        workspace.updated_at,
        workspace.id,
      ],
    );
  }
}
