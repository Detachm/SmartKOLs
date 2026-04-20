import type { AccountsControlPlaneResponse } from "../../../contracts/api/accounts-control-plane";
import type { SqliteStatementExecutor } from "../../../infrastructure/db/sqlite-executor";
import type { AccountsControlPlaneReadModel } from "../application/queries/get-accounts-control-plane";

interface WorkspaceRow {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended" | "closed";
  created_at: string;
  updated_at: string;
}

interface AccountRow {
  id: string;
  workspace_id: string;
  group_id?: string | null;
  platform: "x";
  handle: string;
  display_name: string;
  avatar_url?: string | null;
  status: "active" | "paused" | "disabled" | "error";
  follower_count: number;
  following_count: number;
  post_count: number;
  external_account_id?: string | null;
  created_at: string;
  updated_at: string;
}

interface GroupRow {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
  created_at: string;
  account_count: number;
  active_account_count: number;
}

interface SummaryRow {
  total_workspaces: number;
  total_accounts: number;
  active_accounts: number;
  bound_accounts: number;
  total_groups: number;
  grouped_accounts: number;
  ungrouped_accounts: number;
}

export class SqliteAccountsControlPlaneReadModel implements AccountsControlPlaneReadModel {
  constructor(private readonly db: SqliteStatementExecutor) {}

  async getAccountsControlPlane(workspaceId?: string): Promise<AccountsControlPlaneResponse> {
    const workspaceWhere = workspaceId ? "WHERE id = ?" : "";
    const accountWhere = workspaceId ? "WHERE workspace_id = ?" : "";
    const groupWhere = workspaceId ? "WHERE g.workspace_id = ?" : "";
    const workspaces = this.db.all<WorkspaceRow>(
      `SELECT id, name, slug, status, created_at, updated_at
      FROM workspaces
      ${workspaceWhere}
      ORDER BY updated_at DESC, id DESC`,
      workspaceId ? [workspaceId] : [],
    );

    const accounts = this.db.all<AccountRow>(
      `SELECT
        id,
        workspace_id,
        group_id,
        platform,
        handle,
        display_name,
        avatar_url,
        status,
        follower_count,
        following_count,
        post_count,
        external_account_id,
        created_at,
        updated_at
      FROM accounts
      ${accountWhere}
      ORDER BY updated_at DESC, id DESC`,
      workspaceId ? [workspaceId] : [],
    );

    const groups = this.db.all<GroupRow>(
      `SELECT
        g.id,
        g.workspace_id,
        g.name,
        g.color,
        g.created_at,
        COUNT(a.id) AS account_count,
        SUM(CASE WHEN a.status = 'active' THEN 1 ELSE 0 END) AS active_account_count
      FROM account_groups g
      LEFT JOIN accounts a ON a.group_id = g.id
      ${groupWhere}
      GROUP BY g.id
      ORDER BY g.created_at DESC, g.id DESC`,
      workspaceId ? [workspaceId] : [],
    );

    const summary = workspaceId
      ? this.db.get<SummaryRow>(
        `SELECT
          1 AS total_workspaces,
          COALESCE((SELECT COUNT(*) FROM accounts WHERE workspace_id = ?), 0) AS total_accounts,
          COALESCE((SELECT COUNT(*) FROM accounts WHERE workspace_id = ? AND status = 'active'), 0) AS active_accounts,
          COALESCE((SELECT COUNT(*) FROM accounts WHERE workspace_id = ? AND external_account_id IS NOT NULL), 0) AS bound_accounts,
          COALESCE((SELECT COUNT(*) FROM account_groups WHERE workspace_id = ?), 0) AS total_groups,
          COALESCE((SELECT COUNT(*) FROM accounts WHERE workspace_id = ? AND group_id IS NOT NULL), 0) AS grouped_accounts,
          COALESCE((SELECT COUNT(*) FROM accounts WHERE workspace_id = ? AND group_id IS NULL), 0) AS ungrouped_accounts`,
        [workspaceId, workspaceId, workspaceId, workspaceId, workspaceId, workspaceId],
      )
      : this.db.get<SummaryRow>(
        `SELECT
          COALESCE((SELECT COUNT(*) FROM workspaces), 0) AS total_workspaces,
          COALESCE((SELECT COUNT(*) FROM accounts), 0) AS total_accounts,
          COALESCE((SELECT COUNT(*) FROM accounts WHERE status = 'active'), 0) AS active_accounts,
          COALESCE((SELECT COUNT(*) FROM accounts WHERE external_account_id IS NOT NULL), 0) AS bound_accounts,
          COALESCE((SELECT COUNT(*) FROM account_groups), 0) AS total_groups,
          COALESCE((SELECT COUNT(*) FROM accounts WHERE group_id IS NOT NULL), 0) AS grouped_accounts,
          COALESCE((SELECT COUNT(*) FROM accounts WHERE group_id IS NULL), 0) AS ungrouped_accounts`,
      );

    return {
      workspaces,
      accounts: accounts.map((account) => ({
        ...account,
        group_id: account.group_id ?? undefined,
        avatar_url: account.avatar_url ?? undefined,
        external_account_id: account.external_account_id ?? undefined,
      })),
      groups: groups.map((group) => ({
        group: {
          id: group.id,
          workspace_id: group.workspace_id,
          name: group.name,
          color: group.color,
          created_at: group.created_at,
        },
        account_count: group.account_count,
        active_account_count: group.active_account_count,
      })),
      summary: {
        total_workspaces: summary?.total_workspaces ?? 0,
        total_accounts: summary?.total_accounts ?? 0,
        active_accounts: summary?.active_accounts ?? 0,
        bound_accounts: summary?.bound_accounts ?? 0,
        total_groups: summary?.total_groups ?? 0,
        grouped_accounts: summary?.grouped_accounts ?? 0,
        ungrouped_accounts: summary?.ungrouped_accounts ?? 0,
      },
    };
  }
}
