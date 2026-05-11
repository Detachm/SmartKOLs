import { AppError } from "../../../core/errors/app-error";
import type { WorkspaceSurfaceResponse } from "../../../contracts/api/workspace-surface";
import type { SqliteStatementExecutor } from "../../../infrastructure/db/sqlite-executor";
import type { WorkspaceSurfaceReadModel } from "../application/queries/get-workspace-surface";

interface WorkspaceRow {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended" | "closed";
  created_at: string;
  updated_at: string;
}

interface WorkspaceSummaryRow {
  total_accounts: number;
  active_accounts: number;
  bound_accounts: number;
  total_groups: number;
  grouped_accounts: number;
  ungrouped_accounts: number;
  pending_drafts: number;
  scheduled_posts: number;
  unread_notifications: number;
  active_trends: number;
  open_threads: number;
  configured_alert_channels: number;
  member_count: number;
  failed_queue_items: number;
}

interface ActiveAccountRow {
  id: string;
  workspace_id: string;
  group_id?: string | null;
  handle: string;
  display_name: string;
  avatar_url?: string | null;
  status: "active" | "paused" | "disabled" | "error";
  external_account_id?: string | null;
}

export class SqliteWorkspaceSurfaceReadModel implements WorkspaceSurfaceReadModel {
  constructor(private readonly db: SqliteStatementExecutor) {}

  async getWorkspaceSurface(workspaceId: string): Promise<WorkspaceSurfaceResponse> {
    const workspace = this.db.get<WorkspaceRow>(
      `SELECT id, name, slug, status, created_at, updated_at
      FROM workspaces
      WHERE id = ?`,
      [workspaceId],
    );

    if (!workspace) {
      throw new AppError("NOT_FOUND", "workspace not found", {
        details: { workspace_id: workspaceId },
      });
    }

    const summary = this.db.get<WorkspaceSummaryRow>(
      `SELECT
        COALESCE((SELECT COUNT(*) FROM accounts WHERE workspace_id = ?), 0) AS total_accounts,
        COALESCE((SELECT COUNT(*) FROM accounts WHERE workspace_id = ? AND status = 'active'), 0) AS active_accounts,
        COALESCE((SELECT COUNT(*) FROM accounts WHERE workspace_id = ? AND external_account_id IS NOT NULL), 0) AS bound_accounts,
        COALESCE((SELECT COUNT(*) FROM account_groups WHERE workspace_id = ?), 0) AS total_groups,
        COALESCE((SELECT COUNT(*) FROM accounts WHERE workspace_id = ? AND group_id IS NOT NULL), 0) AS grouped_accounts,
        COALESCE((SELECT COUNT(*) FROM accounts WHERE workspace_id = ? AND group_id IS NULL), 0) AS ungrouped_accounts,
        COALESCE((SELECT COUNT(*) FROM drafts WHERE workspace_id = ? AND status = 'pending'), 0) AS pending_drafts,
        COALESCE((SELECT COUNT(*) FROM publish_schedules WHERE workspace_id = ? AND status IN ('scheduled', 'queued')), 0) AS scheduled_posts,
        COALESCE((SELECT COUNT(*) FROM notifications WHERE workspace_id = ? AND read_at IS NULL), 0) AS unread_notifications,
        COALESCE((SELECT COUNT(*) FROM trends WHERE workspace_id = ? AND status = 'active'), 0) AS active_trends,
        COALESCE((
          SELECT COUNT(*)
          FROM engagement_threads et
          INNER JOIN accounts a ON a.id = et.account_id
          WHERE a.workspace_id = ? AND et.status IN ('open', 'pending_action')
        ), 0) AS open_threads,
        COALESCE((SELECT COUNT(*) FROM alert_channels WHERE workspace_id = ? AND status = 'active'), 0) AS configured_alert_channels,
        COALESCE((SELECT COUNT(*) FROM workspace_members WHERE workspace_id = ?), 0) AS member_count,
        COALESCE((
          SELECT COUNT(*) FROM (
            SELECT id FROM agent_tasks WHERE workspace_id = ? AND status IN ('failed', 'cancelled')
            UNION ALL
            SELECT sfr.id
            FROM source_fetch_runs sfr
            INNER JOIN sources s ON s.id = sfr.source_id
            WHERE s.workspace_id = ? AND sfr.status IN ('failed', 'cancelled')
            UNION ALL
            SELECT pj.id
            FROM publish_jobs pj
            INNER JOIN publish_schedules ps ON ps.id = pj.schedule_id
            WHERE ps.workspace_id = ? AND pj.status IN ('failed', 'cancelled')
            UNION ALL
            SELECT id FROM worker_jobs WHERE workspace_id = ? AND status IN ('failed', 'cancelled')
          )
        ), 0) AS failed_queue_items`,
      [
        workspaceId,
        workspaceId,
        workspaceId,
        workspaceId,
        workspaceId,
        workspaceId,
        workspaceId,
        workspaceId,
        workspaceId,
        workspaceId,
        workspaceId,
        workspaceId,
        workspaceId,
        workspaceId,
        workspaceId,
        workspaceId,
        workspaceId,
      ],
    );

    const activeAccounts = this.db.all<ActiveAccountRow>(
      `SELECT id, workspace_id, group_id, handle, display_name, avatar_url, status, external_account_id
      FROM accounts
      WHERE workspace_id = ? AND status = 'active'
      ORDER BY follower_count DESC, updated_at DESC, id DESC
      LIMIT 24`,
      [workspaceId],
    );

    return {
      workspace,
      summary: {
        total_accounts: summary?.total_accounts ?? 0,
        active_accounts: summary?.active_accounts ?? 0,
        bound_accounts: summary?.bound_accounts ?? 0,
        total_groups: summary?.total_groups ?? 0,
        grouped_accounts: summary?.grouped_accounts ?? 0,
        ungrouped_accounts: summary?.ungrouped_accounts ?? 0,
        pending_drafts: summary?.pending_drafts ?? 0,
        scheduled_posts: summary?.scheduled_posts ?? 0,
        unread_notifications: summary?.unread_notifications ?? 0,
        active_trends: summary?.active_trends ?? 0,
        open_threads: summary?.open_threads ?? 0,
        configured_alert_channels: summary?.configured_alert_channels ?? 0,
        member_count: summary?.member_count ?? 0,
        failed_queue_items: summary?.failed_queue_items ?? 0,
      },
      active_accounts: activeAccounts.map((account) => ({
        id: account.id,
        workspace_id: account.workspace_id,
        group_id: account.group_id ?? undefined,
        handle: account.handle,
        display_name: account.display_name,
        avatar_url: account.avatar_url ?? undefined,
        status: account.status,
        external_account_id: account.external_account_id ?? undefined,
      })),
    };
  }
}
