import type {
  DashboardAccountPreview,
  DashboardOverviewResponse,
  DashboardPendingDraftPreview,
} from "../../../contracts/api/dashboard";
import type { Notification } from "../../../modules/notifications/domain/notification";
import type { Trend } from "../../../modules/trends/domain/trend";
import type { SqliteStatementExecutor } from "../../../infrastructure/db/sqlite-executor";
import type { DashboardOverviewReadModel } from "../application/queries/get-dashboard-overview";

interface SummaryRow {
  total_accounts: number;
  active_accounts: number;
  total_followers: number;
  pending_drafts: number;
  unread_notifications: number;
  active_trends: number;
}

interface AccountPreviewRow {
  id: string;
  handle: string;
  display_name: string;
  avatar_url?: string | null;
  status: "active" | "paused" | "disabled" | "error";
  follower_count: number;
  external_account_id?: string | null;
  updated_at: string;
}

interface PendingDraftPreviewRow {
  id: string;
  account_id: string;
  topic: string;
  updated_at: string;
  account_handle: string;
  account_display_name: string;
  account_avatar_url?: string | null;
  account_status: "active" | "paused" | "disabled" | "error";
}

export class SqliteDashboardOverviewReadModel implements DashboardOverviewReadModel {
  constructor(private readonly db: SqliteStatementExecutor) {}

  async getDashboardOverview(workspaceId: string): Promise<DashboardOverviewResponse> {
    const summary = this.db.get<SummaryRow>(
      `SELECT
        COALESCE((SELECT COUNT(*) FROM accounts WHERE workspace_id = ?), 0) AS total_accounts,
        COALESCE((SELECT COUNT(*) FROM accounts WHERE workspace_id = ? AND status = 'active'), 0) AS active_accounts,
        COALESCE((SELECT SUM(follower_count) FROM accounts WHERE workspace_id = ?), 0) AS total_followers,
        COALESCE((SELECT COUNT(*) FROM drafts WHERE workspace_id = ? AND status = 'pending'), 0) AS pending_drafts,
        COALESCE((SELECT COUNT(*) FROM notifications WHERE workspace_id = ? AND read_at IS NULL), 0) AS unread_notifications,
        COALESCE((SELECT COUNT(*) FROM trends WHERE workspace_id = ? AND status = 'active'), 0) AS active_trends`,
      [workspaceId, workspaceId, workspaceId, workspaceId, workspaceId, workspaceId],
    );

    const recentAccounts = this.db.all<AccountPreviewRow>(
      `SELECT id, handle, display_name, avatar_url, status, follower_count, external_account_id, updated_at
      FROM accounts
      WHERE workspace_id = ?
      ORDER BY updated_at DESC, id DESC
      LIMIT 5`,
      [workspaceId],
    ).map(mapAccountPreview);

    const pendingDrafts = this.db.all<PendingDraftPreviewRow>(
      `SELECT
        d.id,
        d.account_id,
        d.topic,
        d.updated_at,
        a.handle AS account_handle,
        a.display_name AS account_display_name,
        a.avatar_url AS account_avatar_url,
        a.status AS account_status
      FROM drafts d
      INNER JOIN accounts a ON a.id = d.account_id
      WHERE d.workspace_id = ? AND d.status = 'pending'
      ORDER BY d.updated_at DESC, d.id DESC
      LIMIT 5`,
      [workspaceId],
    ).map(mapPendingDraftPreview);

    const trends = this.db.all<Trend>(
      `SELECT id, workspace_id, topic, category, score, status, detected_at, updated_at
      FROM trends
      WHERE workspace_id = ?
      ORDER BY score DESC, updated_at DESC
      LIMIT 10`,
      [workspaceId],
    );

    const notifications = this.db.all<Notification>(
      `SELECT id, workspace_id, type, title, body, link, read_at, created_at
      FROM notifications
      WHERE workspace_id = ?
      ORDER BY created_at DESC
      LIMIT 8`,
      [workspaceId],
    );

    return {
      summary: {
        total_accounts: summary?.total_accounts ?? 0,
        active_accounts: summary?.active_accounts ?? 0,
        total_followers: summary?.total_followers ?? 0,
        pending_drafts: summary?.pending_drafts ?? 0,
        unread_notifications: summary?.unread_notifications ?? 0,
        active_trends: summary?.active_trends ?? 0,
      },
      recent_accounts: recentAccounts,
      pending_drafts_preview: pendingDrafts,
      trends,
      notifications,
    };
  }
}

function mapAccountPreview(row: AccountPreviewRow): DashboardAccountPreview {
  return {
    id: row.id,
    handle: row.handle,
    display_name: row.display_name,
    avatar_url: row.avatar_url ?? undefined,
    status: row.status,
    follower_count: row.follower_count,
    external_account_id: row.external_account_id ?? undefined,
    updated_at: row.updated_at,
  };
}

function mapPendingDraftPreview(row: PendingDraftPreviewRow): DashboardPendingDraftPreview {
  return {
    id: row.id,
    account_id: row.account_id,
    topic: row.topic,
    updated_at: row.updated_at,
    account: {
      id: row.account_id,
      handle: row.account_handle,
      display_name: row.account_display_name,
      avatar_url: row.account_avatar_url ?? undefined,
      status: row.account_status,
    },
  };
}
