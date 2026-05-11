import type { SqliteStatementExecutor } from "../../../infrastructure/db/sqlite-executor";
import type { AccountGroupsRepository } from "../application/ports/account-groups-repository";
import type { AccountGroup } from "../domain/account-group";

export class SqliteAccountGroupsRepository implements AccountGroupsRepository {
  constructor(private readonly db: SqliteStatementExecutor) {}

  async findById(groupId: string): Promise<AccountGroup | null> {
    return this.db.get<AccountGroup>(
      `SELECT id, workspace_id, name, color, created_at
      FROM account_groups
      WHERE id = ?`,
      [groupId],
    );
  }

  async findByWorkspaceAndName(workspaceId: string, name: string): Promise<AccountGroup | null> {
    return this.db.get<AccountGroup>(
      `SELECT id, workspace_id, name, color, created_at
      FROM account_groups
      WHERE workspace_id = ? AND name = ?`,
      [workspaceId, name],
    );
  }

  async listAll(): Promise<AccountGroup[]> {
    return this.db.all<AccountGroup>(
      `SELECT id, workspace_id, name, color, created_at
      FROM account_groups
      ORDER BY created_at DESC, id DESC`,
    );
  }

  async listByWorkspaceId(workspaceId: string): Promise<AccountGroup[]> {
    return this.db.all<AccountGroup>(
      `SELECT id, workspace_id, name, color, created_at
      FROM account_groups
      WHERE workspace_id = ?
      ORDER BY created_at DESC, id DESC`,
      [workspaceId],
    );
  }

  async create(group: AccountGroup): Promise<void> {
    this.db.run(
      `INSERT INTO account_groups (
        id, workspace_id, name, color, created_at
      ) VALUES (?, ?, ?, ?, ?)`,
      [
        group.id,
        group.workspace_id,
        group.name,
        group.color,
        group.created_at,
      ],
    );
  }
}
