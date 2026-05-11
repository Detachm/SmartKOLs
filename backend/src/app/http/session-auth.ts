import { AppError } from "../../core/errors/app-error";
import type { SqliteStatementExecutor } from "../../infrastructure/db/sqlite-executor";

export interface AuthenticatedSession {
  user_id: string;
  workspace_id: string;
}

const USER_ID_HEADER = "x-smartkols-user-id";
const WORKSPACE_ID_HEADER = "x-smartkols-workspace-id";

export function readAuthenticatedSessionFromRequest(request: Request): AuthenticatedSession | null {
  const userId = request.headers.get(USER_ID_HEADER)?.trim() || "";
  const workspaceId = request.headers.get(WORKSPACE_ID_HEADER)?.trim() || "";

  if (!userId && !workspaceId) {
    return null;
  }

  if (!userId || !workspaceId) {
    throw new AppError("UNAUTHORIZED", "backend session headers are incomplete");
  }

  return {
    user_id: userId,
    workspace_id: workspaceId,
  };
}

export async function assertSessionAccess(
  db: SqliteStatementExecutor,
  session: AuthenticatedSession,
): Promise<void> {
  const membership = db.get<{ workspace_id: string }>(
    `SELECT workspace_id
    FROM workspace_members
    WHERE workspace_id = ? AND user_id = ?`,
    [session.workspace_id, session.user_id],
  );

  if (!membership) {
    throw new AppError("FORBIDDEN", "session does not have access to the selected workspace", {
      details: {
        user_id: session.user_id,
        workspace_id: session.workspace_id,
      },
    });
  }
}

export function assertSessionUser(session: AuthenticatedSession | null, userId: string): void {
  if (!session) {
    return;
  }

  if (session.user_id !== userId) {
    throw new AppError("FORBIDDEN", "session cannot access another user context", {
      details: {
        session_user_id: session.user_id,
        requested_user_id: userId,
      },
    });
  }
}

export function assertSessionWorkspace(session: AuthenticatedSession | null, workspaceId: string | undefined): string | undefined {
  if (!session) {
    return workspaceId;
  }

  const normalized = workspaceId?.trim();
  if (!normalized) {
    return session.workspace_id;
  }

  if (normalized !== session.workspace_id) {
    throw new AppError("FORBIDDEN", "session cannot access another workspace", {
      details: {
        session_workspace_id: session.workspace_id,
        requested_workspace_id: normalized,
      },
    });
  }

  return normalized;
}

export async function assertResourceWorkspace(
  db: SqliteStatementExecutor,
  session: AuthenticatedSession | null,
  resource: {
    type:
      | "account"
      | "alert_channel"
      | "brief"
      | "draft"
      | "engagement_thread"
      | "persona_template"
      | "publish_job"
      | "reply_proposal"
      | "recurring_brief_plan"
      | "schedule"
      | "source"
      | "source_watchlist"
      | "source_fetch_run"
      | "worker_job"
      | "agent_task"
      | "agent_run";
    id: string;
  },
): Promise<void> {
  if (!session) {
    return;
  }

  const workspaceId = lookupResourceWorkspaceId(db, resource);
  if (!workspaceId) {
    throw new AppError("NOT_FOUND", `${resource.type} not found`, {
      details: {
        [`${resource.type}_id`]: resource.id,
      },
    });
  }

  assertSessionWorkspace(session, workspaceId);
}

function lookupResourceWorkspaceId(
  db: SqliteStatementExecutor,
  resource: {
    type: AuthenticatedResourceType;
    id: string;
  },
): string | undefined {
  switch (resource.type) {
    case "account":
      return selectWorkspaceId(db, "SELECT workspace_id FROM accounts WHERE id = ?", [resource.id]);
    case "alert_channel":
      return selectWorkspaceId(db, "SELECT workspace_id FROM alert_channels WHERE id = ?", [resource.id]);
    case "brief":
      return selectWorkspaceId(db, "SELECT workspace_id FROM content_briefs WHERE id = ?", [resource.id]);
    case "draft":
      return selectWorkspaceId(db, "SELECT workspace_id FROM drafts WHERE id = ?", [resource.id]);
    case "engagement_thread":
      return selectWorkspaceId(db, "SELECT workspace_id FROM engagement_threads WHERE id = ?", [resource.id]);
    case "persona_template":
      return selectWorkspaceId(db, "SELECT workspace_id FROM persona_templates WHERE id = ?", [resource.id]);
    case "publish_job":
      return selectWorkspaceId(
        db,
        `SELECT ps.workspace_id
        FROM publish_jobs pj
        INNER JOIN publish_schedules ps ON ps.id = pj.schedule_id
        WHERE pj.id = ?`,
        [resource.id],
      );
    case "reply_proposal":
      return selectWorkspaceId(db, "SELECT workspace_id FROM engagement_reply_proposals WHERE id = ?", [resource.id]);
    case "recurring_brief_plan":
      return selectWorkspaceId(db, "SELECT workspace_id FROM recurring_brief_plans WHERE id = ?", [resource.id]);
    case "schedule":
      return selectWorkspaceId(db, "SELECT workspace_id FROM publish_schedules WHERE id = ?", [resource.id]);
    case "source":
      return selectWorkspaceId(db, "SELECT workspace_id FROM sources WHERE id = ?", [resource.id]);
    case "source_watchlist":
      return selectWorkspaceId(db, "SELECT workspace_id FROM source_watchlists WHERE id = ?", [resource.id]);
    case "source_fetch_run":
      return selectWorkspaceId(
        db,
        `SELECT s.workspace_id
        FROM source_fetch_runs sfr
        INNER JOIN sources s ON s.id = sfr.source_id
        WHERE sfr.id = ?`,
        [resource.id],
      );
    case "worker_job":
      return selectWorkspaceId(db, "SELECT workspace_id FROM worker_jobs WHERE id = ?", [resource.id]);
    case "agent_task":
      return selectWorkspaceId(db, "SELECT workspace_id FROM agent_tasks WHERE id = ?", [resource.id]);
    case "agent_run":
      return selectWorkspaceId(
        db,
        `SELECT at.workspace_id
        FROM agent_runs ar
        INNER JOIN agent_tasks at ON at.id = ar.task_id
        WHERE ar.id = ?`,
        [resource.id],
      );
  }
}

type AuthenticatedResourceType =
  | "account"
  | "alert_channel"
  | "brief"
  | "draft"
  | "engagement_thread"
  | "persona_template"
  | "publish_job"
  | "reply_proposal"
  | "recurring_brief_plan"
  | "schedule"
  | "source"
  | "source_watchlist"
  | "source_fetch_run"
  | "worker_job"
  | "agent_task"
  | "agent_run";

function selectWorkspaceId(db: SqliteStatementExecutor, sql: string, params: unknown[]): string | undefined {
  const row = db.get<{ workspace_id: string | null }>(sql, params);
  return row?.workspace_id ?? undefined;
}
