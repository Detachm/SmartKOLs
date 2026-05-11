import type { SqliteExecutor } from "../../../infrastructure/db/sqlite-executor";
import type { SourceWatchlistsRepository } from "../application/ports/source-watchlists-repository";
import type { SourceWatchlist } from "../domain/editorial";

export class SqliteSourceWatchlistsRepository implements SourceWatchlistsRepository {
  constructor(private readonly db: SqliteExecutor) {}

  async findById(watchlistId: string): Promise<SourceWatchlist | null> {
    const row = this.db.get<{
      id: string;
      workspace_id: string;
      account_id: string;
      name: string;
      description?: string | null;
      scope_body: string;
      status: SourceWatchlist["status"];
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, workspace_id, account_id, name, description, scope_body, status, created_at, updated_at
      FROM source_watchlists
      WHERE id = ?`,
      [watchlistId],
    );

    return row ? mapRow(row) : null;
  }

  async listByAccountId(accountId: string): Promise<SourceWatchlist[]> {
    const rows = this.db.all<{
      id: string;
      workspace_id: string;
      account_id: string;
      name: string;
      description?: string | null;
      scope_body: string;
      status: SourceWatchlist["status"];
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, workspace_id, account_id, name, description, scope_body, status, created_at, updated_at
      FROM source_watchlists
      WHERE account_id = ?
      ORDER BY updated_at DESC, created_at DESC`,
      [accountId],
    );

    return rows.map(mapRow);
  }

  async save(watchlist: SourceWatchlist): Promise<void> {
    this.db.run(
      `INSERT INTO source_watchlists (
        id, workspace_id, account_id, name, description, scope_body, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        scope_body = excluded.scope_body,
        status = excluded.status,
        updated_at = excluded.updated_at`,
      [
        watchlist.id,
        watchlist.workspace_id,
        watchlist.account_id,
        watchlist.name,
        watchlist.description ?? null,
        JSON.stringify(watchlist.scope_body),
        watchlist.status,
        watchlist.created_at,
        watchlist.updated_at,
      ],
    );
  }

  async delete(watchlistId: string): Promise<void> {
    this.db.run(`DELETE FROM source_watchlists WHERE id = ?`, [watchlistId]);
  }
}

function mapRow(row: {
  id: string;
  workspace_id: string;
  account_id: string;
  name: string;
  description?: string | null;
  scope_body: string;
  status: SourceWatchlist["status"];
  created_at: string;
  updated_at: string;
}): SourceWatchlist {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    account_id: row.account_id,
    name: row.name,
    description: row.description ?? undefined,
    scope_body: JSON.parse(row.scope_body) as SourceWatchlist["scope_body"],
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
