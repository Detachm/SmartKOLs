import type { ScheduleCalendarItem, ScheduleRangeResponse } from "../../../contracts/api/schedules";
import type { SqliteStatementExecutor } from "../../../infrastructure/db/sqlite-executor";
import type { DraftStatus } from "../../drafts/domain/draft";
import type { DraftVersion } from "../../drafts/domain/draft-version";
import type { PublishJobResponse } from "../../../contracts/api/schedules";
import type { PublishScheduleStatus } from "../domain/publish-schedule";
import type { ScheduleCalendarReadModel } from "../application/queries/list-schedules-in-range";

interface ScheduleCalendarRow {
  schedule_id: string;
  schedule_workspace_id: string;
  schedule_account_id: string;
  schedule_draft_id: string;
  schedule_scheduled_for: string;
  schedule_status: PublishScheduleStatus;
  schedule_created_at: string;
  draft_id: string;
  draft_workspace_id: string;
  draft_account_id: string;
  draft_current_version_id?: string | null;
  draft_status: DraftStatus;
  draft_topic: string;
  draft_created_at: string;
  draft_updated_at: string;
  current_version_id?: string | null;
  current_version_no?: number | null;
  current_version_content?: string | null;
  current_version_metadata?: string | null;
  current_version_created_by_type?: "user" | "agent" | "system" | null;
  current_version_created_by_id?: string | null;
  current_version_created_at?: string | null;
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
  latest_job_id?: string | null;
  latest_job_schedule_id?: string | null;
  latest_job_status?: "queued" | "running" | "succeeded" | "failed" | null;
  latest_job_idempotency_key?: string | null;
  latest_job_error_code?: string | null;
  latest_job_error_message?: string | null;
  latest_job_run_after?: string | null;
  latest_job_started_at?: string | null;
  latest_job_finished_at?: string | null;
}

export class SqliteScheduleCalendarReadModel implements ScheduleCalendarReadModel {
  constructor(private readonly db: SqliteStatementExecutor) {}

  async listSchedulesInRange(input: {
    workspace_id?: string;
    account_id?: string;
    status?: PublishScheduleStatus;
    from: string;
    to: string;
    limit: number;
  }): Promise<ScheduleRangeResponse> {
    const whereClauses = [
      "ps.scheduled_for >= ?",
      "ps.scheduled_for < ?",
    ];
    const params: Array<string | number> = [input.from, input.to];

    if (input.workspace_id) {
      whereClauses.push("ps.workspace_id = ?");
      params.push(input.workspace_id);
    }

    if (input.account_id) {
      whereClauses.push("ps.account_id = ?");
      params.push(input.account_id);
    }

    if (input.status) {
      whereClauses.push("ps.status = ?");
      params.push(input.status);
    }

    const rows = this.db.all<ScheduleCalendarRow>(
      `SELECT
        ps.id AS schedule_id,
        ps.workspace_id AS schedule_workspace_id,
        ps.account_id AS schedule_account_id,
        ps.draft_id AS schedule_draft_id,
        ps.scheduled_for AS schedule_scheduled_for,
        ps.status AS schedule_status,
        ps.created_at AS schedule_created_at,
        d.id AS draft_id,
        d.workspace_id AS draft_workspace_id,
        d.account_id AS draft_account_id,
        d.current_version_id AS draft_current_version_id,
        d.status AS draft_status,
        d.topic AS draft_topic,
        d.created_at AS draft_created_at,
        d.updated_at AS draft_updated_at,
        dv.id AS current_version_id,
        dv.version_no AS current_version_no,
        dv.content AS current_version_content,
        dv.metadata AS current_version_metadata,
        dv.created_by_type AS current_version_created_by_type,
        dv.created_by_id AS current_version_created_by_id,
        dv.created_at AS current_version_created_at,
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
        pj.id AS latest_job_id,
        pj.schedule_id AS latest_job_schedule_id,
        pj.status AS latest_job_status,
        pj.idempotency_key AS latest_job_idempotency_key,
        pj.error_code AS latest_job_error_code,
        pj.error_message AS latest_job_error_message,
        pj.run_after AS latest_job_run_after,
        pj.started_at AS latest_job_started_at,
        pj.finished_at AS latest_job_finished_at
      FROM publish_schedules ps
      INNER JOIN drafts d ON d.id = ps.draft_id
      INNER JOIN accounts a ON a.id = ps.account_id
      INNER JOIN workspaces w ON w.id = ps.workspace_id
      LEFT JOIN draft_versions dv ON dv.id = d.current_version_id
      LEFT JOIN publish_jobs pj ON pj.id = (
        SELECT inner_pj.id
        FROM publish_jobs inner_pj
        WHERE inner_pj.schedule_id = ps.id
        ORDER BY inner_pj.run_after DESC, inner_pj.id DESC
        LIMIT 1
      )
      WHERE ${whereClauses.join(" AND ")}
      ORDER BY ps.scheduled_for ASC, ps.id ASC
      LIMIT ?`,
      [...params, input.limit],
    );

    return {
      schedules: rows.map((row) => mapScheduleCalendarRow(row)),
    };
  }
}

function mapScheduleCalendarRow(row: ScheduleCalendarRow): ScheduleCalendarItem {
  return {
    schedule: {
      id: row.schedule_id,
      workspace_id: row.schedule_workspace_id,
      account_id: row.schedule_account_id,
      draft_id: row.schedule_draft_id,
      scheduled_for: row.schedule_scheduled_for,
      status: row.schedule_status,
      created_at: row.schedule_created_at,
    },
    draft: {
      id: row.draft_id,
      workspace_id: row.draft_workspace_id,
      account_id: row.draft_account_id,
      current_version_id: row.draft_current_version_id ?? undefined,
      status: row.draft_status,
      topic: row.draft_topic,
      created_at: row.draft_created_at,
      updated_at: row.draft_updated_at,
    },
    current_version: mapCurrentVersion(row),
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
    latest_job: mapLatestJob(row),
  };
}

function mapCurrentVersion(row: ScheduleCalendarRow): DraftVersion | undefined {
  if (
    !row.current_version_id ||
    row.current_version_no === null ||
    row.current_version_no === undefined ||
    row.current_version_content === null ||
    row.current_version_content === undefined ||
    row.current_version_metadata === null ||
    row.current_version_metadata === undefined ||
    !row.current_version_created_by_type ||
    !row.current_version_created_at
  ) {
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

function mapLatestJob(row: ScheduleCalendarRow): PublishJobResponse | undefined {
  if (
    !row.latest_job_id ||
    !row.latest_job_schedule_id ||
    !row.latest_job_status ||
    !row.latest_job_idempotency_key ||
    !row.latest_job_run_after
  ) {
    return undefined;
  }

  return {
    id: row.latest_job_id,
    schedule_id: row.latest_job_schedule_id,
    status: row.latest_job_status,
    idempotency_key: row.latest_job_idempotency_key,
    error_code: row.latest_job_error_code ?? undefined,
    error_message: row.latest_job_error_message ?? undefined,
    run_after: row.latest_job_run_after,
    started_at: row.latest_job_started_at ?? undefined,
    finished_at: row.latest_job_finished_at ?? undefined,
  };
}
