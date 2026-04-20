import type {
  MonitoringOperatorQueueItem,
  MonitoringOperatorQueueKind,
  MonitoringOperatorQueueKindSummary,
} from "../../../contracts/api/monitoring";
import type { SqliteStatementExecutor } from "../../../infrastructure/db/sqlite-executor";
import type { MonitoringOperatorQueueReadModel } from "../application/queries/get-monitoring-overview";

interface AgentTaskQueueRow {
  id: string;
  workspace_id: string;
  status: "queued" | "running" | "failed" | "cancelled";
  task_type: string;
  target_type: string;
  target_id: string;
  error_code?: string | null;
  error_message?: string | null;
  created_at: string;
  started_at?: string | null;
  lease_expires_at?: string | null;
  finished_at?: string | null;
  latest_run_id?: string | null;
  agent_code: string;
}

interface WorkerJobQueueRow {
  id: string;
  workspace_id: string;
  status: "queued" | "running" | "failed" | "cancelled";
  job_type: string;
  target_type: string;
  target_id: string;
  error_code?: string | null;
  error_message?: string | null;
  created_at: string;
  run_after: string;
  started_at?: string | null;
  lease_expires_at?: string | null;
  finished_at?: string | null;
}

interface PublishJobQueueRow {
  id: string;
  workspace_id: string;
  account_id: string;
  status: "queued" | "running" | "failed";
  draft_id: string;
  draft_topic: string;
  account_handle: string;
  error_code?: string | null;
  error_message?: string | null;
  created_at: string;
  run_after: string;
  started_at?: string | null;
  lease_expires_at?: string | null;
  finished_at?: string | null;
}

interface SourceFetchQueueRow {
  id: string;
  workspace_id: string;
  account_id: string;
  status: "queued" | "running" | "failed";
  source_id: string;
  source_name: string;
  source_type: string;
  account_handle: string;
  error_code?: string | null;
  error_message?: string | null;
  started_at: string;
  lease_expires_at?: string | null;
  finished_at?: string | null;
}

interface QueueSummaryRow {
  queued_count?: number | null;
  running_count?: number | null;
  failed_count?: number | null;
  cancelled_count?: number | null;
  oldest_queued_at?: string | null;
  oldest_running_started_at?: string | null;
  oldest_failed_at?: string | null;
}

export class SqliteMonitoringOperatorQueueReadModel implements MonitoringOperatorQueueReadModel {
  constructor(private readonly db: SqliteStatementExecutor) {}

  async listByWorkspaceId(workspaceId: string, limit: number): Promise<MonitoringOperatorQueueItem[]> {
    const [agentTasks, workerJobs, publishJobs, sourceFetchRuns] = await Promise.all([
      this.listAgentTasks(workspaceId, limit),
      this.listWorkerJobs(workspaceId, limit),
      this.listPublishJobs(workspaceId, limit),
      this.listSourceFetchRuns(workspaceId, limit),
    ]);

    return [
      ...agentTasks.map(mapAgentTaskRow),
      ...workerJobs.map(mapWorkerJobRow),
      ...publishJobs.map(mapPublishJobRow),
      ...sourceFetchRuns.map(mapSourceFetchRunRow),
    ].sort(compareQueueItems).slice(0, limit);
  }

  async summarizeByWorkspaceId(workspaceId: string): Promise<MonitoringOperatorQueueKindSummary[]> {
    return [
      this.getAgentTaskSummary(workspaceId),
      this.getWorkerJobSummary(workspaceId),
      this.getPublishJobSummary(workspaceId),
      this.getSourceFetchRunSummary(workspaceId),
    ];
  }

  async listRetryableFailedByWorkspaceId(
    workspaceId: string,
    kind: MonitoringOperatorQueueKind,
    limit: number,
  ): Promise<MonitoringOperatorQueueItem[]> {
    switch (kind) {
      case "agent_task":
        return this.listFailedAgentTasks(workspaceId, limit).map(mapAgentTaskRow);
      case "worker_job":
        return this.listFailedWorkerJobs(workspaceId, limit).map(mapWorkerJobRow);
      case "publish_job":
        return this.listFailedPublishJobs(workspaceId, limit).map(mapPublishJobRow);
      case "source_fetch_run":
        return this.listFailedSourceFetchRuns(workspaceId, limit).map(mapSourceFetchRunRow);
    }
  }

  private listAgentTasks(workspaceId: string, limit: number): AgentTaskQueueRow[] {
    return this.db.all<AgentTaskQueueRow>(
      `SELECT
        at.id,
        at.workspace_id,
        at.status,
        at.task_type,
        at.target_type,
        at.target_id,
        at.error_code,
        at.error_message,
        at.created_at,
        at.started_at,
        at.lease_expires_at,
        at.finished_at,
        ad.code AS agent_code,
        ar.id AS latest_run_id
      FROM agent_tasks at
      INNER JOIN agent_definitions ad ON ad.id = at.agent_definition_id
      LEFT JOIN agent_runs ar ON ar.id = (
        SELECT inner_ar.id
        FROM agent_runs inner_ar
        WHERE inner_ar.task_id = at.id
        ORDER BY inner_ar.run_no DESC
        LIMIT 1
      )
      WHERE at.workspace_id = ?
        AND at.status IN ('queued', 'running', 'failed', 'cancelled')
      ORDER BY COALESCE(at.finished_at, at.started_at, at.created_at) DESC, at.id DESC
      LIMIT ?`,
      [workspaceId, limit],
    );
  }

  private listWorkerJobs(workspaceId: string, limit: number): WorkerJobQueueRow[] {
    return this.db.all<WorkerJobQueueRow>(
      `SELECT
        id,
        workspace_id,
        status,
        job_type,
        target_type,
        target_id,
        error_code,
        error_message,
        created_at,
        run_after,
        started_at,
        lease_expires_at,
        finished_at
      FROM worker_jobs
      WHERE workspace_id = ?
        AND status IN ('queued', 'running', 'failed', 'cancelled')
      ORDER BY COALESCE(finished_at, started_at, run_after, created_at) DESC, id DESC
      LIMIT ?`,
      [workspaceId, limit],
    );
  }

  private listPublishJobs(workspaceId: string, limit: number): PublishJobQueueRow[] {
    return this.db.all<PublishJobQueueRow>(
      `SELECT
        pj.id,
        ps.workspace_id,
        ps.account_id,
        pj.status,
        ps.draft_id,
        d.topic AS draft_topic,
        a.handle AS account_handle,
        pj.error_code,
        pj.error_message,
        ps.created_at AS created_at,
        pj.run_after,
        pj.started_at,
        pj.lease_expires_at,
        pj.finished_at
      FROM publish_jobs pj
      INNER JOIN publish_schedules ps ON ps.id = pj.schedule_id
      INNER JOIN drafts d ON d.id = ps.draft_id
      INNER JOIN accounts a ON a.id = ps.account_id
      WHERE ps.workspace_id = ?
        AND pj.status IN ('queued', 'running', 'failed')
        AND NOT (
          pj.status = 'failed'
          AND EXISTS (
            SELECT 1
            FROM publish_jobs newer
            WHERE newer.schedule_id = pj.schedule_id
              AND newer.id <> pj.id
              AND COALESCE(newer.finished_at, newer.started_at, newer.run_after) > COALESCE(pj.finished_at, pj.started_at, pj.run_after)
          )
        )
      ORDER BY COALESCE(pj.finished_at, pj.started_at, pj.run_after, ps.created_at) DESC, pj.id DESC
      LIMIT ?`,
      [workspaceId, limit],
    );
  }

  private listSourceFetchRuns(workspaceId: string, limit: number): SourceFetchQueueRow[] {
    return this.db.all<SourceFetchQueueRow>(
      `SELECT
        sfr.id,
        s.workspace_id,
        s.account_id,
        sfr.status,
        s.id AS source_id,
        s.name AS source_name,
        s.type AS source_type,
        a.handle AS account_handle,
        sfr.error_code,
        sfr.error_message,
        sfr.started_at,
        sfr.lease_expires_at,
        sfr.finished_at
      FROM source_fetch_runs sfr
      INNER JOIN sources s ON s.id = sfr.source_id
      INNER JOIN accounts a ON a.id = s.account_id
      WHERE s.workspace_id = ?
        AND sfr.status IN ('queued', 'running', 'failed')
        AND NOT (
          sfr.status = 'failed'
          AND EXISTS (
            SELECT 1
            FROM source_fetch_runs newer
            WHERE newer.source_id = sfr.source_id
              AND newer.id <> sfr.id
              AND COALESCE(newer.finished_at, newer.started_at) > COALESCE(sfr.finished_at, sfr.started_at)
          )
        )
      ORDER BY COALESCE(sfr.finished_at, sfr.started_at) DESC, sfr.id DESC
      LIMIT ?`,
      [workspaceId, limit],
    );
  }

  private getAgentTaskSummary(workspaceId: string): MonitoringOperatorQueueKindSummary {
    const row = this.db.get<QueueSummaryRow>(
      `SELECT
        SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) AS queued_count,
        SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) AS running_count,
        SUM(CASE
          WHEN status = 'failed'
            AND NOT EXISTS (
              SELECT 1
              FROM agent_tasks newer
              WHERE newer.workspace_id = agent_tasks.workspace_id
                AND newer.task_type = agent_tasks.task_type
                AND newer.target_type = agent_tasks.target_type
                AND newer.target_id = agent_tasks.target_id
                AND newer.id <> agent_tasks.id
                AND COALESCE(newer.finished_at, newer.started_at, newer.created_at) > COALESCE(agent_tasks.finished_at, agent_tasks.started_at, agent_tasks.created_at)
            )
          THEN 1 ELSE 0 END) AS failed_count,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_count,
        MIN(CASE WHEN status = 'queued' THEN created_at END) AS oldest_queued_at,
        MIN(CASE WHEN status = 'running' THEN started_at END) AS oldest_running_started_at,
        MIN(CASE
          WHEN status = 'failed'
            AND NOT EXISTS (
              SELECT 1
              FROM agent_tasks newer
              WHERE newer.workspace_id = agent_tasks.workspace_id
                AND newer.task_type = agent_tasks.task_type
                AND newer.target_type = agent_tasks.target_type
                AND newer.target_id = agent_tasks.target_id
                AND newer.id <> agent_tasks.id
                AND COALESCE(newer.finished_at, newer.started_at, newer.created_at) > COALESCE(agent_tasks.finished_at, agent_tasks.started_at, agent_tasks.created_at)
            )
          THEN COALESCE(finished_at, created_at) END) AS oldest_failed_at
      FROM agent_tasks
      WHERE workspace_id = ?`,
      [workspaceId],
    );

    return mapQueueSummary("agent_task", row);
  }

  private getWorkerJobSummary(workspaceId: string): MonitoringOperatorQueueKindSummary {
    const row = this.db.get<QueueSummaryRow>(
      `SELECT
        SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) AS queued_count,
        SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) AS running_count,
        SUM(CASE
          WHEN status = 'failed'
            AND NOT EXISTS (
              SELECT 1
              FROM worker_jobs newer
              WHERE newer.workspace_id = worker_jobs.workspace_id
                AND newer.job_type = worker_jobs.job_type
                AND newer.target_type = worker_jobs.target_type
                AND newer.target_id = worker_jobs.target_id
                AND newer.id <> worker_jobs.id
                AND COALESCE(newer.finished_at, newer.started_at, newer.run_after, newer.created_at) > COALESCE(worker_jobs.finished_at, worker_jobs.started_at, worker_jobs.run_after, worker_jobs.created_at)
            )
          THEN 1 ELSE 0 END) AS failed_count,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_count,
        MIN(CASE WHEN status = 'queued' THEN run_after END) AS oldest_queued_at,
        MIN(CASE WHEN status = 'running' THEN started_at END) AS oldest_running_started_at,
        MIN(CASE
          WHEN status = 'failed'
            AND NOT EXISTS (
              SELECT 1
              FROM worker_jobs newer
              WHERE newer.workspace_id = worker_jobs.workspace_id
                AND newer.job_type = worker_jobs.job_type
                AND newer.target_type = worker_jobs.target_type
                AND newer.target_id = worker_jobs.target_id
                AND newer.id <> worker_jobs.id
                AND COALESCE(newer.finished_at, newer.started_at, newer.run_after, newer.created_at) > COALESCE(worker_jobs.finished_at, worker_jobs.started_at, worker_jobs.run_after, worker_jobs.created_at)
            )
          THEN COALESCE(finished_at, created_at) END) AS oldest_failed_at
      FROM worker_jobs
      WHERE workspace_id = ?`,
      [workspaceId],
    );

    return mapQueueSummary("worker_job", row);
  }

  private getPublishJobSummary(workspaceId: string): MonitoringOperatorQueueKindSummary {
    const row = this.db.get<QueueSummaryRow>(
      `SELECT
        SUM(CASE WHEN pj.status = 'queued' THEN 1 ELSE 0 END) AS queued_count,
        SUM(CASE WHEN pj.status = 'running' THEN 1 ELSE 0 END) AS running_count,
        SUM(CASE
          WHEN pj.status = 'failed'
            AND NOT EXISTS (
              SELECT 1
              FROM publish_jobs newer
              WHERE newer.schedule_id = pj.schedule_id
                AND newer.id <> pj.id
                AND COALESCE(newer.finished_at, newer.started_at, newer.run_after) > COALESCE(pj.finished_at, pj.started_at, pj.run_after)
            )
          THEN 1 ELSE 0 END) AS failed_count,
        0 AS cancelled_count,
        MIN(CASE WHEN pj.status = 'queued' THEN pj.run_after END) AS oldest_queued_at,
        MIN(CASE WHEN pj.status = 'running' THEN pj.started_at END) AS oldest_running_started_at,
        MIN(CASE
          WHEN pj.status = 'failed'
            AND NOT EXISTS (
              SELECT 1
              FROM publish_jobs newer
              WHERE newer.schedule_id = pj.schedule_id
                AND newer.id <> pj.id
                AND COALESCE(newer.finished_at, newer.started_at, newer.run_after) > COALESCE(pj.finished_at, pj.started_at, pj.run_after)
            )
          THEN COALESCE(pj.finished_at, pj.run_after) END) AS oldest_failed_at
      FROM publish_jobs pj
      INNER JOIN publish_schedules ps ON ps.id = pj.schedule_id
      WHERE ps.workspace_id = ?`,
      [workspaceId],
    );

    return mapQueueSummary("publish_job", row);
  }

  private getSourceFetchRunSummary(workspaceId: string): MonitoringOperatorQueueKindSummary {
    const row = this.db.get<QueueSummaryRow>(
      `SELECT
        SUM(CASE WHEN sfr.status = 'queued' THEN 1 ELSE 0 END) AS queued_count,
        SUM(CASE WHEN sfr.status = 'running' THEN 1 ELSE 0 END) AS running_count,
        SUM(CASE
          WHEN sfr.status = 'failed'
            AND NOT EXISTS (
              SELECT 1
              FROM source_fetch_runs newer
              WHERE newer.source_id = sfr.source_id
                AND newer.id <> sfr.id
                AND COALESCE(newer.finished_at, newer.started_at) > COALESCE(sfr.finished_at, sfr.started_at)
            )
          THEN 1 ELSE 0 END) AS failed_count,
        0 AS cancelled_count,
        MIN(CASE WHEN sfr.status = 'queued' THEN sfr.started_at END) AS oldest_queued_at,
        MIN(CASE WHEN sfr.status = 'running' THEN sfr.started_at END) AS oldest_running_started_at,
        MIN(CASE
          WHEN sfr.status = 'failed'
            AND NOT EXISTS (
              SELECT 1
              FROM source_fetch_runs newer
              WHERE newer.source_id = sfr.source_id
                AND newer.id <> sfr.id
                AND COALESCE(newer.finished_at, newer.started_at) > COALESCE(sfr.finished_at, sfr.started_at)
            )
          THEN COALESCE(sfr.finished_at, sfr.started_at) END) AS oldest_failed_at
      FROM source_fetch_runs sfr
      INNER JOIN sources s ON s.id = sfr.source_id
      WHERE s.workspace_id = ?`,
      [workspaceId],
    );

    return mapQueueSummary("source_fetch_run", row);
  }

  private listFailedAgentTasks(workspaceId: string, limit: number): AgentTaskQueueRow[] {
    return this.db.all<AgentTaskQueueRow>(
      `SELECT
        at.id,
        at.workspace_id,
        at.status,
        at.task_type,
        at.target_type,
        at.target_id,
        at.error_code,
        at.error_message,
        at.created_at,
        at.started_at,
        at.lease_expires_at,
        at.finished_at,
        ad.code AS agent_code,
        ar.id AS latest_run_id
      FROM agent_tasks at
      INNER JOIN agent_definitions ad ON ad.id = at.agent_definition_id
      LEFT JOIN agent_runs ar ON ar.id = (
        SELECT inner_ar.id
        FROM agent_runs inner_ar
        WHERE inner_ar.task_id = at.id
        ORDER BY inner_ar.run_no DESC
        LIMIT 1
      )
      WHERE at.workspace_id = ?
        AND at.status = 'failed'
        AND NOT EXISTS (
          SELECT 1
          FROM agent_tasks newer
          WHERE newer.workspace_id = at.workspace_id
            AND newer.task_type = at.task_type
            AND newer.target_type = at.target_type
            AND newer.target_id = at.target_id
            AND newer.id <> at.id
            AND COALESCE(newer.finished_at, newer.started_at, newer.created_at) > COALESCE(at.finished_at, at.started_at, at.created_at)
        )
      ORDER BY COALESCE(at.finished_at, at.started_at, at.created_at) ASC, at.id ASC
      LIMIT ?`,
      [workspaceId, limit],
    );
  }

  private listFailedWorkerJobs(workspaceId: string, limit: number): WorkerJobQueueRow[] {
    return this.db.all<WorkerJobQueueRow>(
      `SELECT
        id,
        workspace_id,
        status,
        job_type,
        target_type,
        target_id,
        error_code,
        error_message,
        created_at,
        run_after,
        started_at,
        lease_expires_at,
        finished_at
      FROM worker_jobs
      WHERE workspace_id = ?
        AND status = 'failed'
        AND NOT EXISTS (
          SELECT 1
          FROM worker_jobs newer
          WHERE newer.workspace_id = worker_jobs.workspace_id
            AND newer.job_type = worker_jobs.job_type
            AND newer.target_type = worker_jobs.target_type
            AND newer.target_id = worker_jobs.target_id
            AND newer.id <> worker_jobs.id
            AND COALESCE(newer.finished_at, newer.started_at, newer.run_after, newer.created_at) > COALESCE(worker_jobs.finished_at, worker_jobs.started_at, worker_jobs.run_after, worker_jobs.created_at)
        )
      ORDER BY COALESCE(finished_at, started_at, run_after, created_at) ASC, id ASC
      LIMIT ?`,
      [workspaceId, limit],
    );
  }

  private listFailedPublishJobs(workspaceId: string, limit: number): PublishJobQueueRow[] {
    return this.db.all<PublishJobQueueRow>(
      `SELECT
        pj.id,
        ps.workspace_id,
        ps.account_id,
        pj.status,
        ps.draft_id,
        d.topic AS draft_topic,
        a.handle AS account_handle,
        pj.error_code,
        pj.error_message,
        ps.created_at AS created_at,
        pj.run_after,
        pj.started_at,
        pj.lease_expires_at,
        pj.finished_at
      FROM publish_jobs pj
      INNER JOIN publish_schedules ps ON ps.id = pj.schedule_id
      INNER JOIN drafts d ON d.id = ps.draft_id
      INNER JOIN accounts a ON a.id = ps.account_id
      WHERE ps.workspace_id = ?
        AND pj.status = 'failed'
        AND NOT EXISTS (
          SELECT 1
          FROM publish_jobs newer
          WHERE newer.schedule_id = pj.schedule_id
            AND newer.id <> pj.id
            AND COALESCE(newer.finished_at, newer.started_at, newer.run_after) > COALESCE(pj.finished_at, pj.started_at, pj.run_after)
        )
      ORDER BY COALESCE(pj.finished_at, pj.started_at, pj.run_after, ps.created_at) ASC, pj.id ASC
      LIMIT ?`,
      [workspaceId, limit],
    );
  }

  private listFailedSourceFetchRuns(workspaceId: string, limit: number): SourceFetchQueueRow[] {
    return this.db.all<SourceFetchQueueRow>(
      `SELECT
        sfr.id,
        s.workspace_id,
        s.account_id,
        sfr.status,
        s.id AS source_id,
        s.name AS source_name,
        s.type AS source_type,
        a.handle AS account_handle,
        sfr.error_code,
        sfr.error_message,
        sfr.started_at,
        sfr.lease_expires_at,
        sfr.finished_at
      FROM source_fetch_runs sfr
      INNER JOIN sources s ON s.id = sfr.source_id
      INNER JOIN accounts a ON a.id = s.account_id
      WHERE s.workspace_id = ?
        AND sfr.status = 'failed'
        AND NOT EXISTS (
          SELECT 1
          FROM source_fetch_runs newer
          WHERE newer.source_id = sfr.source_id
            AND newer.id <> sfr.id
            AND COALESCE(newer.finished_at, newer.started_at) > COALESCE(sfr.finished_at, sfr.started_at)
        )
      ORDER BY COALESCE(sfr.finished_at, sfr.started_at) ASC, sfr.id ASC
      LIMIT ?`,
      [workspaceId, limit],
    );
  }
}

function mapAgentTaskRow(row: AgentTaskQueueRow): MonitoringOperatorQueueItem {
  return {
    kind: "agent_task",
    id: row.id,
    workspace_id: row.workspace_id,
    status: row.status,
    title: `${row.agent_code} · ${row.task_type}`,
    subtitle: `${row.target_type} / ${row.target_id}`,
    error_code: row.error_code ?? undefined,
    error_message: row.error_message ?? undefined,
    created_at: row.created_at,
    started_at: row.started_at ?? undefined,
    lease_expires_at: row.lease_expires_at ?? undefined,
    finished_at: row.finished_at ?? undefined,
    latest_run_id: row.latest_run_id ?? undefined,
    retry_supported: row.status === "failed",
  };
}

function mapWorkerJobRow(row: WorkerJobQueueRow): MonitoringOperatorQueueItem {
  return {
    kind: "worker_job",
    id: row.id,
    workspace_id: row.workspace_id,
    status: row.status,
    title: `worker · ${row.job_type}`,
    subtitle: `${row.target_type} / ${row.target_id}`,
    error_code: row.error_code ?? undefined,
    error_message: row.error_message ?? undefined,
    created_at: row.created_at,
    run_after: row.run_after,
    started_at: row.started_at ?? undefined,
    lease_expires_at: row.lease_expires_at ?? undefined,
    finished_at: row.finished_at ?? undefined,
    retry_supported: row.status === "failed",
  };
}

function mapPublishJobRow(row: PublishJobQueueRow): MonitoringOperatorQueueItem {
  return {
    kind: "publish_job",
    id: row.id,
    workspace_id: row.workspace_id,
    account_id: row.account_id,
    status: row.status,
    title: `publish · ${row.account_handle}`,
    subtitle: row.draft_topic,
    error_code: row.error_code ?? undefined,
    error_message: row.error_message ?? undefined,
    created_at: row.created_at,
    run_after: row.run_after,
    started_at: row.started_at ?? undefined,
    lease_expires_at: row.lease_expires_at ?? undefined,
    finished_at: row.finished_at ?? undefined,
    retry_supported: row.status === "failed",
  };
}

function mapSourceFetchRunRow(row: SourceFetchQueueRow): MonitoringOperatorQueueItem {
  return {
    kind: "source_fetch_run",
    id: row.id,
    workspace_id: row.workspace_id,
    account_id: row.account_id,
    status: row.status,
    title: `source fetch · ${row.source_name}`,
    subtitle: `${row.source_type} · ${row.account_handle}`,
    error_code: row.error_code ?? undefined,
    error_message: row.error_message ?? undefined,
    created_at: row.started_at,
    started_at: row.started_at,
    lease_expires_at: row.lease_expires_at ?? undefined,
    finished_at: row.finished_at ?? undefined,
    retry_supported: row.status === "failed",
  };
}

function mapQueueSummary(
  kind: MonitoringOperatorQueueKind,
  row: QueueSummaryRow | null | undefined,
): MonitoringOperatorQueueKindSummary {
  const failedCount = row?.failed_count ?? 0;
  return {
    kind,
    queued_count: row?.queued_count ?? 0,
    running_count: row?.running_count ?? 0,
    failed_count: failedCount,
    cancelled_count: row?.cancelled_count ?? 0,
    retry_supported_failed_count: failedCount,
    oldest_queued_at: row?.oldest_queued_at ?? undefined,
    oldest_running_started_at: row?.oldest_running_started_at ?? undefined,
    oldest_failed_at: row?.oldest_failed_at ?? undefined,
  };
}

function compareQueueItems(left: MonitoringOperatorQueueItem, right: MonitoringOperatorQueueItem): number {
  const statusDelta = statusPriority(left.status) - statusPriority(right.status);
  if (statusDelta !== 0) {
    return statusDelta;
  }

  return activityTime(right).localeCompare(activityTime(left));
}

function statusPriority(status: MonitoringOperatorQueueItem["status"]): number {
  switch (status) {
    case "failed":
    case "cancelled":
      return 0;
    case "running":
      return 1;
    default:
      return 2;
  }
}

function activityTime(item: MonitoringOperatorQueueItem): string {
  return item.finished_at || item.started_at || item.run_after || item.created_at;
}
