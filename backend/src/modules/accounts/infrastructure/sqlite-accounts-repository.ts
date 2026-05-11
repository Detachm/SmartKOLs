import type { AccountsRepository } from "../application/ports/accounts-repository";
import type { Account } from "../domain/account";
import type { SqliteStatementExecutor } from "../../../infrastructure/db/sqlite-executor";

export class SqliteAccountsRepository implements AccountsRepository {
  constructor(private readonly db: SqliteStatementExecutor) {}

  async findById(accountId: string): Promise<Account | null> {
    return this.db.get<Account>(
      `SELECT
        id, workspace_id, group_id, platform, handle, display_name, avatar_url, status,
        follower_count, following_count, post_count, external_account_id, created_at, updated_at
      FROM accounts
      WHERE id = ?`,
      [accountId],
    );
  }

  async listByIds(accountIds: string[]): Promise<Account[]> {
    if (accountIds.length === 0) {
      return [];
    }

    const placeholders = accountIds.map(() => "?").join(", ");
    return this.db.all<Account>(
      `SELECT
        id, workspace_id, group_id, platform, handle, display_name, avatar_url, status,
        follower_count, following_count, post_count, external_account_id, created_at, updated_at
      FROM accounts
      WHERE id IN (${placeholders})`,
      accountIds,
    );
  }

  async findByWorkspaceAndHandle(workspaceId: string, handle: string): Promise<Account | null> {
    return this.db.get<Account>(
      `SELECT
        id, workspace_id, group_id, platform, handle, display_name, avatar_url, status,
        follower_count, following_count, post_count, external_account_id, created_at, updated_at
      FROM accounts
      WHERE workspace_id = ? AND handle = ?`,
      [workspaceId, handle],
    );
  }

  async listAll(): Promise<Account[]> {
    return this.db.all<Account>(
      `SELECT
        id, workspace_id, group_id, platform, handle, display_name, avatar_url, status,
        follower_count, following_count, post_count, external_account_id, created_at, updated_at
      FROM accounts
      ORDER BY created_at DESC`,
    );
  }

  async listByWorkspaceId(workspaceId: string): Promise<Account[]> {
    return this.db.all<Account>(
      `SELECT
        id, workspace_id, group_id, platform, handle, display_name, avatar_url, status,
        follower_count, following_count, post_count, external_account_id, created_at, updated_at
      FROM accounts
      WHERE workspace_id = ?
      ORDER BY created_at DESC`,
      [workspaceId],
    );
  }

  async create(account: Account): Promise<void> {
    this.db.run(
      `INSERT INTO accounts (
        id, workspace_id, group_id, platform, handle, display_name, avatar_url, status,
        follower_count, following_count, post_count, external_account_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        account.id,
        account.workspace_id,
        account.group_id ?? null,
        account.platform,
        account.handle,
        account.display_name,
        account.avatar_url ?? null,
        account.status,
        account.follower_count,
        account.following_count,
        account.post_count,
        account.external_account_id ?? null,
        account.created_at,
        account.updated_at,
      ],
    );
  }

  async save(account: Account): Promise<void> {
    this.db.run(
      `INSERT INTO accounts (
        id, workspace_id, group_id, platform, handle, display_name, avatar_url, status,
        follower_count, following_count, post_count, external_account_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        group_id = excluded.group_id,
        handle = excluded.handle,
        display_name = excluded.display_name,
        avatar_url = excluded.avatar_url,
        status = excluded.status,
        follower_count = excluded.follower_count,
        following_count = excluded.following_count,
        post_count = excluded.post_count,
        external_account_id = excluded.external_account_id,
        updated_at = excluded.updated_at`,
      [
        account.id,
        account.workspace_id,
        account.group_id ?? null,
        account.platform,
        account.handle,
        account.display_name,
        account.avatar_url ?? null,
        account.status,
        account.follower_count,
        account.following_count,
        account.post_count,
        account.external_account_id ?? null,
        account.created_at,
        account.updated_at,
      ],
    );
  }

  async delete(accountId: string): Promise<void> {
    this.db.run(
      `DELETE FROM accounts
      WHERE id = ?`,
      [accountId],
    );
  }
}
