import type { AccountGroupListItemResponse } from "../../../contracts/api/account-groups";
import type { AppChromeOverviewResponse } from "../../../contracts/api/app-chrome";
import type { Notification } from "../../../modules/notifications/domain/notification";
import type { SqliteStatementExecutor } from "../../../infrastructure/db/sqlite-executor";
import type { AppChromeOverviewReadModel } from "../application/queries/get-app-chrome-overview";

interface SummaryRow {
  total_groups: number;
  total_accounts: number;
  active_accounts: number;
  bound_accounts: number;
  grouped_accounts: number;
  ungrouped_accounts: number;
  pending_drafts: number;
  scheduled_posts: number;
  unread_notifications: number;
  critical_alerts: number;
  failed_connector_requests: number;
  failed_model_requests: number;
  failed_queue_items: number;
}

interface GroupLinkRow {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
  created_at: string;
  account_count: number;
  active_account_count: number;
}

export class SqliteAppChromeOverviewReadModel implements AppChromeOverviewReadModel {
  constructor(private readonly db: SqliteStatementExecutor) {}

  async getOverview(input: {
    workspace_id: string;
    notification_limit: number;
    group_limit: number;
  }): Promise<AppChromeOverviewResponse> {
    const summary = this.db.get<SummaryRow>(
      `SELECT
        COALESCE((SELECT COUNT(*) FROM account_groups WHERE workspace_id = ?), 0) AS total_groups,
        COALESCE((SELECT COUNT(*) FROM accounts WHERE workspace_id = ?), 0) AS total_accounts,
        COALESCE((SELECT COUNT(*) FROM accounts WHERE workspace_id = ? AND status = 'active'), 0) AS active_accounts,
        COALESCE((SELECT COUNT(*) FROM accounts WHERE workspace_id = ? AND external_account_id IS NOT NULL), 0) AS bound_accounts,
        COALESCE((SELECT COUNT(*) FROM accounts WHERE workspace_id = ? AND group_id IS NOT NULL), 0) AS grouped_accounts,
        COALESCE((SELECT COUNT(*) FROM accounts WHERE workspace_id = ? AND group_id IS NULL), 0) AS ungrouped_accounts,
        COALESCE((SELECT COUNT(*) FROM drafts WHERE workspace_id = ? AND status = 'pending'), 0) AS pending_drafts,
        COALESCE((SELECT COUNT(*) FROM publish_schedules WHERE workspace_id = ? AND status IN ('scheduled', 'queued')), 0) AS scheduled_posts,
        COALESCE((SELECT COUNT(*) FROM notifications WHERE workspace_id = ? AND read_at IS NULL), 0) AS unread_notifications,
        COALESCE((SELECT COUNT(*) FROM alerts WHERE workspace_id = ? AND severity = 'critical'), 0) AS critical_alerts,
        COALESCE((SELECT COUNT(*) FROM connector_requests WHERE workspace_id = ? AND status IN ('failed', 'rate_limited')), 0) AS failed_connector_requests,
        COALESCE((SELECT COUNT(*) FROM model_requests WHERE workspace_id = ? AND status IN ('failed', 'invalid_output')), 0) AS failed_model_requests,
        COALESCE((SELECT COUNT(*) FROM agent_tasks WHERE workspace_id = ? AND status = 'failed'), 0)
          + COALESCE((SELECT COUNT(*) FROM worker_jobs WHERE workspace_id = ? AND status = 'failed'), 0)
          + COALESCE((
            SELECT COUNT(*)
            FROM publish_jobs pj
            INNER JOIN publish_schedules ps ON ps.id = pj.schedule_id
            WHERE ps.workspace_id = ? AND pj.status = 'failed'
          ), 0)
          + COALESCE((
            SELECT COUNT(*)
            FROM source_fetch_runs sfr
            INNER JOIN sources s ON s.id = sfr.source_id
            WHERE s.workspace_id = ? AND sfr.status = 'failed'
          ), 0) AS failed_queue_items`,
      [
        input.workspace_id,
        input.workspace_id,
        input.workspace_id,
        input.workspace_id,
        input.workspace_id,
        input.workspace_id,
        input.workspace_id,
        input.workspace_id,
        input.workspace_id,
        input.workspace_id,
        input.workspace_id,
        input.workspace_id,
        input.workspace_id,
        input.workspace_id,
        input.workspace_id,
        input.workspace_id,
      ],
    );

    const groupLinks = this.db.all<GroupLinkRow>(
      `SELECT
        g.id,
        g.workspace_id,
        g.name,
        g.color,
        g.created_at,
        COUNT(a.id) AS account_count,
        COALESCE(SUM(CASE WHEN a.status = 'active' THEN 1 ELSE 0 END), 0) AS active_account_count
      FROM account_groups g
      LEFT JOIN accounts a ON a.group_id = g.id
      WHERE g.workspace_id = ?
      GROUP BY g.id, g.workspace_id, g.name, g.color, g.created_at
      ORDER BY account_count DESC, active_account_count DESC, g.created_at DESC, g.id DESC
      LIMIT ?`,
      [input.workspace_id, input.group_limit],
    ).map(mapGroupLinkRow);

    const notifications = this.db.all<Notification>(
      `SELECT id, workspace_id, type, title, body, link, read_at, created_at
      FROM notifications
      WHERE workspace_id = ?
      ORDER BY CASE WHEN read_at IS NULL THEN 0 ELSE 1 END, created_at DESC
      LIMIT ?`,
      [input.workspace_id, input.notification_limit],
    );

    const failedQueueItems = summary?.failed_queue_items ?? 0;
    const monitoringAttentionItems = failedQueueItems
      + (summary?.critical_alerts ?? 0)
      + (summary?.failed_connector_requests ?? 0)
      + (summary?.failed_model_requests ?? 0);

    return {
      summary: {
        total_groups: summary?.total_groups ?? 0,
        total_accounts: summary?.total_accounts ?? 0,
        active_accounts: summary?.active_accounts ?? 0,
        bound_accounts: summary?.bound_accounts ?? 0,
        grouped_accounts: summary?.grouped_accounts ?? 0,
        ungrouped_accounts: summary?.ungrouped_accounts ?? 0,
        pending_drafts: summary?.pending_drafts ?? 0,
        scheduled_posts: summary?.scheduled_posts ?? 0,
        unread_notifications: summary?.unread_notifications ?? 0,
        critical_alerts: summary?.critical_alerts ?? 0,
        failed_queue_items: failedQueueItems,
        monitoring_attention_items: monitoringAttentionItems,
      },
      group_links: groupLinks,
      recent_notifications: notifications,
    };
  }
}

function mapGroupLinkRow(row: GroupLinkRow): AccountGroupListItemResponse {
  return {
    group: {
      id: row.id,
      workspace_id: row.workspace_id,
      name: row.name,
      color: row.color,
      created_at: row.created_at,
    },
    account_count: row.account_count,
    active_account_count: row.active_account_count,
  };
}
