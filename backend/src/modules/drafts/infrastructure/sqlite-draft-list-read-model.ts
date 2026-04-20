import type { DraftListItem, DraftListResponse } from "../../../contracts/api/drafts";
import type { PublishScheduleResponse } from "../../../contracts/api/schedules";
import type { SqliteStatementExecutor } from "../../../infrastructure/db/sqlite-executor";
import type { DraftReview, DraftStatus } from "../domain/draft";
import type { DraftVersion } from "../domain/draft-version";
import type { ListDraftsReadModel } from "../application/queries/list-drafts";

interface DraftListRow {
  draft_id: string;
  draft_workspace_id: string;
  draft_account_id: string;
  draft_trend_id?: string | null;
  draft_current_version_id?: string | null;
  draft_status: DraftStatus;
  draft_topic: string;
  draft_scheduled_for?: string | null;
  draft_generated_by_run_id?: string | null;
  draft_created_at: string;
  draft_updated_at: string;
  account_id: string;
  account_workspace_id: string;
  account_handle: string;
  account_display_name: string;
  account_avatar_url?: string | null;
  account_status: "active" | "paused" | "disabled" | "error";
  workspace_id: string;
  workspace_name: string;
  workspace_slug: string;
  workspace_status: "active" | "suspended" | "closed";
  current_version_id?: string | null;
  current_version_no?: number | null;
  current_version_content?: string | null;
  current_version_metadata?: string | null;
  current_version_created_by_type?: "user" | "agent" | "system" | null;
  current_version_created_by_id?: string | null;
  current_version_created_at?: string | null;
  latest_review_id?: string | null;
  latest_review_reviewer_type?: "user" | "agent" | null;
  latest_review_reviewer_id?: string | null;
  latest_review_action?: "approve" | "reject" | "edit" | "request_regenerate" | null;
  latest_review_comment?: string | null;
  latest_review_created_at?: string | null;
  schedule_id?: string | null;
  schedule_workspace_id?: string | null;
  schedule_account_id?: string | null;
  schedule_draft_id?: string | null;
  schedule_scheduled_for?: string | null;
  schedule_status?: "scheduled" | "queued" | "published" | "failed" | "cancelled" | null;
  schedule_created_at?: string | null;
}

export class SqliteDraftListReadModel implements ListDraftsReadModel {
  constructor(private readonly db: SqliteStatementExecutor) {}

  async listDrafts(input: {
    workspace_id?: string;
    account_id?: string;
    status?: DraftStatus;
    limit: number;
  }): Promise<DraftListResponse> {
    const whereClauses: string[] = [];
    const params: Array<string | number> = [];

    if (input.workspace_id) {
      whereClauses.push("d.workspace_id = ?");
      params.push(input.workspace_id);
    }

    if (input.account_id) {
      whereClauses.push("d.account_id = ?");
      params.push(input.account_id);
    }

    if (input.status) {
      whereClauses.push("d.status = ?");
      params.push(input.status);
    }

    const whereSql = whereClauses.length > 0
      ? `WHERE ${whereClauses.join(" AND ")}`
      : "";

    const rows = this.db.all<DraftListRow>(
      `SELECT
        d.id AS draft_id,
        d.workspace_id AS draft_workspace_id,
        d.account_id AS draft_account_id,
        d.trend_id AS draft_trend_id,
        d.current_version_id AS draft_current_version_id,
        d.status AS draft_status,
        d.topic AS draft_topic,
        d.scheduled_for AS draft_scheduled_for,
        d.generated_by_run_id AS draft_generated_by_run_id,
        d.created_at AS draft_created_at,
        d.updated_at AS draft_updated_at,
        a.id AS account_id,
        a.workspace_id AS account_workspace_id,
        a.handle AS account_handle,
        a.display_name AS account_display_name,
        a.avatar_url AS account_avatar_url,
        a.status AS account_status,
        w.id AS workspace_id,
        w.name AS workspace_name,
        w.slug AS workspace_slug,
        w.status AS workspace_status,
        dv.id AS current_version_id,
        dv.version_no AS current_version_no,
        dv.content AS current_version_content,
        dv.metadata AS current_version_metadata,
        dv.created_by_type AS current_version_created_by_type,
        dv.created_by_id AS current_version_created_by_id,
        dv.created_at AS current_version_created_at,
        dr.id AS latest_review_id,
        dr.reviewer_type AS latest_review_reviewer_type,
        dr.reviewer_id AS latest_review_reviewer_id,
        dr.action AS latest_review_action,
        dr.comment AS latest_review_comment,
        dr.created_at AS latest_review_created_at,
        ps.id AS schedule_id,
        ps.workspace_id AS schedule_workspace_id,
        ps.account_id AS schedule_account_id,
        ps.draft_id AS schedule_draft_id,
        ps.scheduled_for AS schedule_scheduled_for,
        ps.status AS schedule_status,
        ps.created_at AS schedule_created_at
      FROM drafts d
      INNER JOIN accounts a ON a.id = d.account_id
      INNER JOIN workspaces w ON w.id = d.workspace_id
      LEFT JOIN draft_versions dv ON dv.id = d.current_version_id
      LEFT JOIN draft_reviews dr ON dr.id = (
        SELECT inner_dr.id
        FROM draft_reviews inner_dr
        WHERE inner_dr.draft_id = d.id
        ORDER BY inner_dr.created_at DESC, inner_dr.id DESC
        LIMIT 1
      )
      LEFT JOIN publish_schedules ps ON ps.id = (
        SELECT inner_ps.id
        FROM publish_schedules inner_ps
        WHERE inner_ps.draft_id = d.id
        ORDER BY inner_ps.created_at DESC, inner_ps.id DESC
        LIMIT 1
      )
      ${whereSql}
      ORDER BY d.updated_at DESC, d.id DESC
      LIMIT ?`,
      [...params, input.limit],
    );

    return {
      drafts: rows.map((row) => mapDraftListRow(row)),
    };
  }
}

function mapDraftListRow(row: DraftListRow): DraftListItem {
  return {
    draft: {
      id: row.draft_id,
      workspace_id: row.draft_workspace_id,
      account_id: row.draft_account_id,
      trend_id: row.draft_trend_id ?? undefined,
      current_version_id: row.draft_current_version_id ?? undefined,
      status: row.draft_status,
      topic: row.draft_topic,
      scheduled_for: row.draft_scheduled_for ?? undefined,
      generated_by_run_id: row.draft_generated_by_run_id ?? undefined,
      created_at: row.draft_created_at,
      updated_at: row.draft_updated_at,
    },
    account: {
      id: row.account_id,
      workspace_id: row.account_workspace_id,
      handle: row.account_handle,
      display_name: row.account_display_name,
      avatar_url: row.account_avatar_url ?? undefined,
      status: row.account_status,
    },
    workspace: {
      id: row.workspace_id,
      name: row.workspace_name,
      slug: row.workspace_slug,
      status: row.workspace_status,
    },
    current_version: mapCurrentVersion(row),
    latest_review: mapLatestReview(row),
    schedule: mapSchedule(row),
  };
}

function mapCurrentVersion(row: DraftListRow): DraftVersion | undefined {
  if (!row.current_version_id || row.current_version_no === null || row.current_version_no === undefined || row.current_version_content === null || row.current_version_content === undefined || row.current_version_metadata === null || row.current_version_metadata === undefined || !row.current_version_created_by_type || !row.current_version_created_at) {
    return undefined;
  }

  return {
    id: row.current_version_id,
    draft_id: row.draft_id,
    version_no: row.current_version_no,
    content: row.current_version_content,
    metadata: row.current_version_metadata,
    created_by_type: row.current_version_created_by_type,
    created_by_id: row.current_version_created_by_id ?? undefined,
    created_at: row.current_version_created_at,
  };
}

function mapLatestReview(row: DraftListRow): DraftReview | undefined {
  if (!row.latest_review_id || !row.latest_review_reviewer_type || !row.latest_review_action || !row.latest_review_created_at) {
    return undefined;
  }

  return {
    id: row.latest_review_id,
    draft_id: row.draft_id,
    reviewer_type: row.latest_review_reviewer_type,
    reviewer_id: row.latest_review_reviewer_id ?? undefined,
    action: row.latest_review_action,
    comment: row.latest_review_comment ?? undefined,
    created_at: row.latest_review_created_at,
  };
}

function mapSchedule(row: DraftListRow): PublishScheduleResponse | undefined {
  if (!row.schedule_id || !row.schedule_workspace_id || !row.schedule_account_id || !row.schedule_draft_id || !row.schedule_scheduled_for || !row.schedule_status || !row.schedule_created_at) {
    return undefined;
  }

  return {
    id: row.schedule_id,
    workspace_id: row.schedule_workspace_id,
    account_id: row.schedule_account_id,
    draft_id: row.schedule_draft_id,
    scheduled_for: row.schedule_scheduled_for,
    status: row.schedule_status,
    created_at: row.schedule_created_at,
  };
}
