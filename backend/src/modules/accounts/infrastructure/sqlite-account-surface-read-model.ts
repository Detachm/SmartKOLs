import { AppError } from "../../../core/errors/app-error";
import type { SqliteStatementExecutor } from "../../../infrastructure/db/sqlite-executor";
import type { AccountSurfaceReadModel } from "../application/queries/get-account-surface";
import type { AccountSurfaceResponse } from "../../../contracts/api/account-surface";

interface AccountSurfaceRow {
  account_id: string;
  workspace_id: string;
  group_id?: string | null;
  platform: "x";
  handle: string;
  display_name: string;
  avatar_url?: string | null;
  account_status: "active" | "paused" | "disabled" | "error";
  follower_count: number;
  following_count: number;
  post_count: number;
  external_account_id?: string | null;
  account_created_at: string;
  account_updated_at: string;
  workspace_name: string;
  workspace_slug: string;
  workspace_status: "active" | "suspended" | "closed";
  workspace_created_at: string;
  workspace_updated_at: string;
  group_name?: string | null;
  group_color?: string | null;
  group_created_at?: string | null;
  health_score_id?: string | null;
  health_score_value?: number | null;
  health_risk_level?: "low" | "medium" | "high" | null;
  health_computed_at?: string | null;
}

interface AccountSurfaceSummaryRow {
  source_count: number;
  active_source_count: number;
  ready_briefs: number;
  pending_briefs: number;
  pending_drafts: number;
  scheduled_posts: number;
  open_threads: number;
}

export class SqliteAccountSurfaceReadModel implements AccountSurfaceReadModel {
  constructor(private readonly db: SqliteStatementExecutor) {}

  async getAccountSurface(accountId: string): Promise<AccountSurfaceResponse> {
    const row = this.db.get<AccountSurfaceRow>(
      `SELECT
        a.id AS account_id,
        a.workspace_id,
        a.group_id,
        a.platform,
        a.handle,
        a.display_name,
        a.avatar_url,
        a.status AS account_status,
        a.follower_count,
        a.following_count,
        a.post_count,
        a.external_account_id,
        a.created_at AS account_created_at,
        a.updated_at AS account_updated_at,
        w.name AS workspace_name,
        w.slug AS workspace_slug,
        w.status AS workspace_status,
        w.created_at AS workspace_created_at,
        w.updated_at AS workspace_updated_at,
        g.name AS group_name,
        g.color AS group_color,
        g.created_at AS group_created_at,
        hs.id AS health_score_id,
        hs.score AS health_score_value,
        hs.risk_level AS health_risk_level,
        hs.computed_at AS health_computed_at
      FROM accounts a
      INNER JOIN workspaces w ON w.id = a.workspace_id
      LEFT JOIN account_groups g ON g.id = a.group_id
      LEFT JOIN health_scores hs ON hs.id = (
        SELECT inner_hs.id
        FROM health_scores inner_hs
        WHERE inner_hs.account_id = a.id
        ORDER BY inner_hs.computed_at DESC
        LIMIT 1
      )
      WHERE a.id = ?`,
      [accountId],
    );

    if (!row) {
      throw new AppError("NOT_FOUND", "account not found", {
        details: { account_id: accountId },
      });
    }

    const summary = this.db.get<AccountSurfaceSummaryRow>(
      `SELECT
        COALESCE((SELECT COUNT(*) FROM sources WHERE account_id = ?), 0) AS source_count,
        COALESCE((SELECT COUNT(*) FROM sources WHERE account_id = ? AND status = 'active'), 0) AS active_source_count,
        COALESCE((SELECT COUNT(*) FROM content_briefs WHERE account_id = ? AND status = 'ready'), 0) AS ready_briefs,
        COALESCE((SELECT COUNT(*) FROM content_briefs WHERE account_id = ? AND status IN ('queued', 'running')), 0) AS pending_briefs,
        COALESCE((SELECT COUNT(*) FROM drafts WHERE account_id = ? AND status = 'pending'), 0) AS pending_drafts,
        COALESCE((SELECT COUNT(*) FROM publish_schedules WHERE account_id = ? AND status IN ('scheduled', 'queued')), 0) AS scheduled_posts,
        COALESCE((SELECT COUNT(*) FROM engagement_threads WHERE account_id = ? AND status IN ('open', 'pending_action')), 0) AS open_threads`,
      [
        accountId,
        accountId,
        accountId,
        accountId,
        accountId,
        accountId,
        accountId,
      ],
    );

    return {
      account: {
        id: row.account_id,
        workspace_id: row.workspace_id,
        group_id: row.group_id ?? undefined,
        platform: row.platform,
        handle: row.handle,
        display_name: row.display_name,
        avatar_url: row.avatar_url ?? undefined,
        status: row.account_status,
        follower_count: row.follower_count,
        following_count: row.following_count,
        post_count: row.post_count,
        external_account_id: row.external_account_id ?? undefined,
        created_at: row.account_created_at,
        updated_at: row.account_updated_at,
      },
      workspace: {
        id: row.workspace_id,
        name: row.workspace_name,
        slug: row.workspace_slug,
        status: row.workspace_status,
        created_at: row.workspace_created_at,
        updated_at: row.workspace_updated_at,
      },
      group: row.group_id && row.group_name && row.group_color && row.group_created_at
        ? {
            id: row.group_id,
            workspace_id: row.workspace_id,
            name: row.group_name,
            color: row.group_color,
            created_at: row.group_created_at,
          }
        : undefined,
      health_score: row.health_score_id
        && row.health_score_value !== null
        && row.health_score_value !== undefined
        && row.health_risk_level
        && row.health_computed_at
        ? {
            id: row.health_score_id,
            workspace_id: row.workspace_id,
            account_id: row.account_id,
            score: row.health_score_value,
            risk_level: row.health_risk_level,
            computed_at: row.health_computed_at,
          }
        : undefined,
      summary: {
        source_count: summary?.source_count ?? 0,
        active_source_count: summary?.active_source_count ?? 0,
        ready_briefs: summary?.ready_briefs ?? 0,
        pending_briefs: summary?.pending_briefs ?? 0,
        pending_drafts: summary?.pending_drafts ?? 0,
        scheduled_posts: summary?.scheduled_posts ?? 0,
        open_threads: summary?.open_threads ?? 0,
      },
    };
  }
}
