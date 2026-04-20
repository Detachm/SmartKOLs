import { AppError } from "../../../core/errors/app-error";
import type { SqliteExecutor } from "../../../infrastructure/db/sqlite-executor";
import type {
  AccountAnalyticsConnectorFailure,
  AccountAnalyticsDailyPoint,
  AccountAnalyticsHeatmapPoint,
  AccountAnalyticsRecentPost,
  AccountAnalyticsResponse,
} from "../../../contracts/api/analytics";
import type { AccountAnalyticsReadModel } from "../application/queries/get-account-analytics";

interface AccountRow {
  id: string;
  workspace_id: string;
  handle: string;
  display_name: string;
  avatar_url?: string;
  status: "active" | "paused" | "disabled" | "error";
  external_account_id?: string;
}

interface CountRow {
  value: number;
}

interface ApprovalRow {
  action: "approve" | "reject";
  value: number;
}

interface DailyRow {
  date_key: string;
  value: number;
}

interface HeatmapRow {
  weekday_index: number;
  hour: number;
  value: number;
}

export class SqliteAccountAnalyticsReadModel implements AccountAnalyticsReadModel {
  constructor(private readonly db: SqliteExecutor) {}

  async getAccountAnalytics(input: {
    account_id: string;
    window_days: number;
  }): Promise<AccountAnalyticsResponse> {
    const account = this.db.get<AccountRow>(
      `SELECT id, workspace_id, handle, display_name, avatar_url, status, external_account_id
      FROM accounts
      WHERE id = ?`,
      [input.account_id],
    );

    if (!account) {
      throw new AppError("NOT_FOUND", "account not found", {
        details: { account_id: input.account_id },
      });
    }

    const since = new Date(Date.now() - input.window_days * 24 * 60 * 60 * 1000).toISOString();

    const [
      draftsCreated,
      postsPublished,
      sourceDocuments,
      connectorFailures,
      approvalRows,
      publishJobs,
      currentHealth,
      dailyDrafts,
      dailyPosts,
      dailyDocuments,
      dailyFailures,
      heatmapRows,
      recentPosts,
      recentFailures,
    ] = await Promise.all([
      this.countValue(`SELECT COUNT(*) AS value FROM drafts WHERE account_id = ? AND created_at >= ?`, [account.id, since]),
      this.countValue(`SELECT COUNT(*) AS value FROM published_posts WHERE account_id = ? AND published_at >= ?`, [account.id, since]),
      this.countValue(
        `SELECT COUNT(*) AS value
        FROM source_documents sd
        INNER JOIN sources s ON s.id = sd.source_id
        WHERE s.account_id = ? AND sd.created_at >= ?`,
        [account.id, since],
      ),
      this.countValue(
        `SELECT COUNT(*) AS value
        FROM connector_requests
        WHERE account_id = ?
          AND started_at >= ?
          AND (status = 'failed' OR status = 'rate_limited')`,
        [account.id, since],
      ),
      Promise.resolve(this.db.all<ApprovalRow>(
        `SELECT dr.action AS action, COUNT(*) AS value
        FROM draft_reviews dr
        INNER JOIN drafts d ON d.id = dr.draft_id
        WHERE d.account_id = ?
          AND dr.created_at >= ?
          AND dr.action IN ('approve', 'reject')
        GROUP BY dr.action`,
        [account.id, since],
      )),
      Promise.resolve(this.db.get<{ total: number; succeeded: number }>(
        `SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN pj.status = 'succeeded' THEN 1 ELSE 0 END) AS succeeded
        FROM publish_jobs pj
        INNER JOIN publish_schedules ps ON ps.id = pj.schedule_id
        WHERE ps.account_id = ?
          AND pj.run_after >= ?`,
        [account.id, since],
      )),
      Promise.resolve(this.db.get<{ score?: number; risk_level?: "low" | "medium" | "high" }>(
        `SELECT score, risk_level
        FROM health_scores
        WHERE account_id = ?
        ORDER BY computed_at DESC
        LIMIT 1`,
        [account.id],
      )),
      Promise.resolve(this.db.all<DailyRow>(
        `SELECT substr(created_at, 1, 10) AS date_key, COUNT(*) AS value
        FROM drafts
        WHERE account_id = ? AND created_at >= ?
        GROUP BY substr(created_at, 1, 10)`,
        [account.id, since],
      )),
      Promise.resolve(this.db.all<DailyRow>(
        `SELECT substr(published_at, 1, 10) AS date_key, COUNT(*) AS value
        FROM published_posts
        WHERE account_id = ? AND published_at >= ?
        GROUP BY substr(published_at, 1, 10)`,
        [account.id, since],
      )),
      Promise.resolve(this.db.all<DailyRow>(
        `SELECT substr(sd.created_at, 1, 10) AS date_key, COUNT(*) AS value
        FROM source_documents sd
        INNER JOIN sources s ON s.id = sd.source_id
        WHERE s.account_id = ? AND sd.created_at >= ?
        GROUP BY substr(sd.created_at, 1, 10)`,
        [account.id, since],
      )),
      Promise.resolve(this.db.all<DailyRow>(
        `SELECT substr(started_at, 1, 10) AS date_key, COUNT(*) AS value
        FROM connector_requests
        WHERE account_id = ?
          AND started_at >= ?
          AND (status = 'failed' OR status = 'rate_limited')
        GROUP BY substr(started_at, 1, 10)`,
        [account.id, since],
      )),
      Promise.resolve(this.db.all<HeatmapRow>(
        `SELECT
          CAST(strftime('%w', published_at) AS INTEGER) AS weekday_index,
          CAST(strftime('%H', published_at) AS INTEGER) AS hour,
          COUNT(*) AS value
        FROM published_posts
        WHERE account_id = ? AND published_at >= ?
        GROUP BY weekday_index, hour`,
        [account.id, since],
      )),
      Promise.resolve(this.db.all<AccountAnalyticsRecentPost>(
        `SELECT id, external_post_id, external_post_url, content, published_at
        FROM published_posts
        WHERE account_id = ?
        ORDER BY published_at DESC
        LIMIT 5`,
        [account.id],
      )),
      Promise.resolve(this.db.all<AccountAnalyticsConnectorFailure>(
        `SELECT id, endpoint_code, error_code, error_message, started_at
        FROM connector_requests
        WHERE account_id = ?
          AND (status = 'failed' OR status = 'rate_limited')
        ORDER BY started_at DESC
        LIMIT 5`,
        [account.id],
      )),
    ]);

    const approved = approvalRows.find((item) => item.action === "approve")?.value ?? 0;
    const rejected = approvalRows.find((item) => item.action === "reject")?.value ?? 0;
    const reviewedTotal = approved + rejected;
    const publishTotal = publishJobs?.total ?? 0;
    const publishSucceeded = publishJobs?.succeeded ?? 0;

    return {
      account,
      summary: {
        window_days: input.window_days,
        drafts_created: draftsCreated,
        drafts_approved: approved,
        drafts_rejected: rejected,
        approval_rate: reviewedTotal > 0 ? Number((approved / reviewedTotal).toFixed(4)) : undefined,
        posts_published: postsPublished,
        publish_success_rate: publishTotal > 0 ? Number((publishSucceeded / publishTotal).toFixed(4)) : undefined,
        source_documents: sourceDocuments,
        connector_failures: connectorFailures,
        current_health_score: currentHealth?.score,
        current_risk_level: currentHealth?.risk_level,
      },
      daily_activity: buildDailySeries(input.window_days, dailyDrafts, dailyPosts, dailyDocuments, dailyFailures),
      publish_heatmap: buildHeatmap(heatmapRows),
      recent_published_posts: recentPosts,
      recent_connector_failures: recentFailures,
    };
  }

  private async countValue(sql: string, params: unknown[]): Promise<number> {
    const row = this.db.get<CountRow>(sql, params);
    return row?.value ?? 0;
  }
}

function buildDailySeries(
  windowDays: number,
  draftRows: DailyRow[],
  postRows: DailyRow[],
  documentRows: DailyRow[],
  failureRows: DailyRow[],
): AccountAnalyticsDailyPoint[] {
  const draftMap = new Map(draftRows.map((row) => [row.date_key, row.value]));
  const postMap = new Map(postRows.map((row) => [row.date_key, row.value]));
  const documentMap = new Map(documentRows.map((row) => [row.date_key, row.value]));
  const failureMap = new Map(failureRows.map((row) => [row.date_key, row.value]));
  const points: AccountAnalyticsDailyPoint[] = [];

  for (let index = windowDays - 1; index >= 0; index -= 1) {
    const date = new Date(Date.now() - index * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    points.push({
      date,
      drafts_created: draftMap.get(date) ?? 0,
      posts_published: postMap.get(date) ?? 0,
      source_documents: documentMap.get(date) ?? 0,
      connector_failures: failureMap.get(date) ?? 0,
    });
  }

  return points;
}

function buildHeatmap(rows: HeatmapRow[]): AccountAnalyticsHeatmapPoint[] {
  const weekdayCodes = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
  return rows
    .map((row) => ({
      weekday_code: weekdayCodes[row.weekday_index] === "sun" ? "sun" : weekdayCodes[row.weekday_index],
      hour: row.hour,
      published_posts: row.value,
    }))
    .filter((row): row is AccountAnalyticsHeatmapPoint => row.hour >= 0 && row.hour <= 23);
}
