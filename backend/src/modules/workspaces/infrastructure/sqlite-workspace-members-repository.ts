import type { SqliteExecutor } from "../../../infrastructure/db/sqlite-executor";
import type { WorkspaceMembersRepository } from "../application/ports/workspace-members-repository";
import type { WorkspaceMember } from "../domain/workspace-member";

export class SqliteWorkspaceMembersRepository implements WorkspaceMembersRepository {
  constructor(private readonly db: SqliteExecutor) {}

  async find(workspaceId: string, userId: string): Promise<WorkspaceMember | null> {
    return this.db.get<WorkspaceMember>(
      `SELECT workspace_id, user_id, role_code, joined_at
      FROM workspace_members
      WHERE workspace_id = ? AND user_id = ?`,
      [workspaceId, userId],
    );
  }

  async listByWorkspaceId(workspaceId: string): Promise<WorkspaceMember[]> {
    return this.db.all<WorkspaceMember>(
      `SELECT workspace_id, user_id, role_code, joined_at
      FROM workspace_members
      WHERE workspace_id = ?
      ORDER BY joined_at ASC`,
      [workspaceId],
    );
  }

  async listByUserId(userId: string): Promise<WorkspaceMember[]> {
    return this.db.all<WorkspaceMember>(
      `SELECT workspace_id, user_id, role_code, joined_at
      FROM workspace_members
      WHERE user_id = ?
      ORDER BY joined_at ASC`,
      [userId],
    );
  }

  async save(member: WorkspaceMember): Promise<void> {
    this.db.run(
      `INSERT INTO workspace_members (
        workspace_id, user_id, role_code, joined_at
      ) VALUES (?, ?, ?, ?)
      ON CONFLICT(workspace_id, user_id) DO UPDATE SET
        role_code = excluded.role_code`,
      [member.workspace_id, member.user_id, member.role_code, member.joined_at],
    );
  }

  async delete(workspaceId: string, userId: string): Promise<void> {
    this.db.run(
      `DELETE FROM workspace_members
      WHERE workspace_id = ? AND user_id = ?`,
      [workspaceId, userId],
    );
  }
}
