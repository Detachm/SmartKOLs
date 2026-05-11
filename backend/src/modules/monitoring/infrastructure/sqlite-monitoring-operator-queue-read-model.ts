import type {
  MonitoringOperatorQueueItem,
  MonitoringOperatorQueueKind,
  MonitoringOperatorQueueKindSummary,
} from "../../../contracts/api/monitoring";
import { classifyOperatorError } from "../domain/operator-error-classification";
import type { SqliteStatementExecutor } from "../../../infrastructure/db/sqlite-executor";
import type { MonitoringOperatorQueueReadModel } from "../application/queries/get-monitoring-overview";

interface AccountReadinessQueueRow {
  id: string;
  workspace_id: string;
  handle: string;
  display_name: string;
  status: "active" | "paused" | "disabled" | "error";
  updated_at: string;
  credential_status?: "valid" | "invalid" | "expired" | "revoked" | null;
  persona_id?: string | null;
  active_source_count: number | null;
  recent_document_count: number | null;
  autopost_status?: "active" | "paused" | null;
  engagement_status?: "active" | "paused" | null;
}

interface DraftReviewQueueRow {
  workspace_id: string;
  account_id: string;
  account_handle: string;
  pending_count: number;
  oldest_created_at: string;
  newest_updated_at: string;
}

interface ReplyReviewQueueRow {
  workspace_id: string;
  account_id: string;
  account_handle: string;
  pending_review_count: number;
  approved_pending_send_count: number;
  oldest_created_at: string;
  newest_activity_at: string;
}

interface RuntimeHealthQueueRow {
  id: string;
  issue_code: "http_server_missing" | "worker_missing" | "process_stale";
  process_type?: "http_server" | "worker" | null;
  process_name?: string | null;
  heartbeat_age_seconds?: number | null;
  last_heartbeat_at: string;
}

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
  payload: string;
  reply_proposal_id?: string | null;
  reply_proposal_status?: string | null;
  reply_proposal_content?: string | null;
  reply_thread_id?: string | null;
  reply_thread_status?: string | null;
  reply_channel?: string | null;
  reply_counterpart_handle?: string | null;
  reply_account_id?: string | null;
  reply_account_handle?: string | null;
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
    const [readinessItems, draftReviews, replyReviews, runtimeHealthItems, agentTasks, workerJobs, publishJobs, sourceFetchRuns] = await Promise.all([
      this.listAccountReadinessItems(workspaceId, limit),
      this.listDraftReviewItems(workspaceId, limit),
      this.listReplyReviewItems(workspaceId, limit),
      this.listRuntimeHealthItems(limit),
      this.listAgentTasks(workspaceId, limit),
      this.listWorkerJobs(workspaceId, limit),
      this.listPublishJobs(workspaceId, limit),
      this.listSourceFetchRuns(workspaceId, limit),
    ]);

    return [
      ...readinessItems.map(mapAccountReadinessRow),
      ...draftReviews.map(mapDraftReviewRow),
      ...replyReviews.map(mapReplyReviewRow),
      ...runtimeHealthItems.map((row) => mapRuntimeHealthRow(row, workspaceId)),
      ...agentTasks.map(mapAgentTaskRow),
      ...workerJobs.map(mapWorkerJobRow),
      ...publishJobs.map(mapPublishJobRow),
      ...sourceFetchRuns.map(mapSourceFetchRunRow),
    ].sort(compareQueueItems).slice(0, limit);
  }

  async summarizeByWorkspaceId(workspaceId: string): Promise<MonitoringOperatorQueueKindSummary[]> {
    return [
      this.getAccountReadinessSummary(workspaceId),
      this.getDraftReviewSummary(workspaceId),
      this.getReplyReviewSummary(workspaceId),
      this.getRuntimeHealthSummary(),
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
      case "account_readiness":
      case "draft_review":
      case "reply_review":
      case "runtime_health":
        return [];
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

  private listAccountReadinessItems(workspaceId: string, limit: number): AccountReadinessQueueRow[] {
    return this.db.all<AccountReadinessQueueRow>(
      `SELECT
        a.id,
        a.workspace_id,
        a.handle,
        a.display_name,
        a.status,
        a.updated_at,
        ac.status AS credential_status,
        p.id AS persona_id,
        COALESCE((
          SELECT COUNT(*)
          FROM sources s
          WHERE s.account_id = a.id AND s.status = 'active'
        ), 0) AS active_source_count,
        COALESCE((
          SELECT COUNT(*)
          FROM source_documents sd
          INNER JOIN sources s ON s.id = sd.source_id
          WHERE s.account_id = a.id
          LIMIT 1
        ), 0) AS recent_document_count,
        ap.status AS autopost_status,
        ep.status AS engagement_status
      FROM accounts a
      LEFT JOIN account_credentials ac ON ac.account_id = a.id
      LEFT JOIN personas p ON p.account_id = a.id
      LEFT JOIN autopost_policies ap ON ap.account_id = a.id
      LEFT JOIN engagement_policies ep ON ep.account_id = a.id
      WHERE a.workspace_id = ?
        AND a.status = 'active'
        AND (ap.id IS NOT NULL OR ep.id IS NOT NULL)
        AND (
          ac.id IS NULL
          OR ac.status <> 'valid'
          OR p.id IS NULL
          OR NOT EXISTS (
            SELECT 1 FROM sources active_sources
            WHERE active_sources.account_id = a.id AND active_sources.status = 'active'
          )
          OR NOT EXISTS (
            SELECT 1
            FROM source_documents sd
            INNER JOIN sources source_for_doc ON source_for_doc.id = sd.source_id
            WHERE source_for_doc.account_id = a.id
          )
          OR (ap.id IS NULL AND ep.id IS NULL)
          OR (ap.status = 'paused' AND (ep.id IS NULL OR ep.status = 'paused'))
          OR (ep.status = 'paused' AND (ap.id IS NULL OR ap.status = 'paused'))
        )
      ORDER BY a.updated_at DESC, a.id DESC
      LIMIT ?`,
      [workspaceId, limit],
    );
  }

  private listDraftReviewItems(workspaceId: string, limit: number): DraftReviewQueueRow[] {
    return this.db.all<DraftReviewQueueRow>(
      `SELECT
        d.workspace_id,
        d.account_id,
        a.handle AS account_handle,
        COUNT(*) AS pending_count,
        MIN(d.created_at) AS oldest_created_at,
        MAX(d.updated_at) AS newest_updated_at
      FROM drafts d
      INNER JOIN accounts a ON a.id = d.account_id
      WHERE d.workspace_id = ?
        AND d.status = 'pending'
      GROUP BY d.workspace_id, d.account_id, a.handle
      ORDER BY oldest_created_at ASC, d.account_id ASC
      LIMIT ?`,
      [workspaceId, limit],
    );
  }

  private listReplyReviewItems(workspaceId: string, limit: number): ReplyReviewQueueRow[] {
    return this.db.all<ReplyReviewQueueRow>(
      `SELECT
        rp.workspace_id,
        rp.account_id,
        a.handle AS account_handle,
        SUM(CASE WHEN rp.status = 'pending_review' THEN 1 ELSE 0 END) AS pending_review_count,
        SUM(CASE WHEN rp.status = 'approved' THEN 1 ELSE 0 END) AS approved_pending_send_count,
        MIN(rp.created_at) AS oldest_created_at,
        MAX(COALESCE(rp.reviewed_at, rp.created_at)) AS newest_activity_at
      FROM engagement_reply_proposals rp
      INNER JOIN accounts a ON a.id = rp.account_id
      WHERE rp.workspace_id = ?
        AND rp.status IN ('pending_review', 'approved')
      GROUP BY rp.workspace_id, rp.account_id, a.handle
      ORDER BY oldest_created_at ASC, rp.account_id ASC
      LIMIT ?`,
      [workspaceId, limit],
    );
  }

  private listRuntimeHealthItems(limit: number): RuntimeHealthQueueRow[] {
    const staleCutoffSql = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-45 seconds')";
    return this.db.all<RuntimeHealthQueueRow>(
      `SELECT
        'runtime:missing:http_server' AS id,
        'http_server_missing' AS issue_code,
        'http_server' AS process_type,
        NULL AS process_name,
        NULL AS heartbeat_age_seconds,
        strftime('%Y-%m-%dT%H:%M:%fZ', 'now') AS last_heartbeat_at
      WHERE NOT EXISTS (
        SELECT 1
        FROM runtime_processes rp
        WHERE rp.process_type = 'http_server'
          AND rp.status = 'running'
          AND rp.last_heartbeat_at >= ${staleCutoffSql}
      )
      UNION ALL
      SELECT
        'runtime:missing:worker' AS id,
        'worker_missing' AS issue_code,
        'worker' AS process_type,
        NULL AS process_name,
        NULL AS heartbeat_age_seconds,
        strftime('%Y-%m-%dT%H:%M:%fZ', 'now') AS last_heartbeat_at
      WHERE NOT EXISTS (
        SELECT 1
        FROM runtime_processes rp
        WHERE rp.process_type = 'worker'
          AND rp.status = 'running'
          AND rp.last_heartbeat_at >= ${staleCutoffSql}
      )
      UNION ALL
      SELECT
        'runtime:stale:' || rp.id AS id,
        'process_stale' AS issue_code,
        rp.process_type,
        rp.process_name,
        CAST((julianday('now') - julianday(rp.last_heartbeat_at)) * 86400 AS INTEGER) AS heartbeat_age_seconds,
        rp.last_heartbeat_at
      FROM runtime_processes rp
      WHERE rp.status = 'running'
        AND rp.last_heartbeat_at < ${staleCutoffSql}
        AND NOT EXISTS (
          SELECT 1
          FROM runtime_processes fresh
          WHERE fresh.process_type = rp.process_type
            AND fresh.status = 'running'
            AND fresh.last_heartbeat_at >= ${staleCutoffSql}
        )
      ORDER BY last_heartbeat_at ASC
      LIMIT ?`,
      [limit],
    );
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
        AND at.status IN ('queued', 'running', 'failed')
        AND (
          at.status = 'failed'
          OR (at.status = 'queued' AND datetime(at.created_at) <= datetime('now', '-10 minutes'))
          OR (
            at.status = 'running'
            AND (
              (at.lease_expires_at IS NOT NULL AND datetime(at.lease_expires_at) <= datetime('now'))
              OR datetime(at.started_at) <= datetime('now', '-15 minutes')
            )
          )
        )
        AND NOT (
          at.status = 'failed'
          AND EXISTS (
            SELECT 1
            FROM agent_tasks newer
            WHERE newer.workspace_id = at.workspace_id
              AND newer.task_type = at.task_type
              AND newer.target_type = at.target_type
              AND newer.target_id = at.target_id
              AND newer.id <> at.id
              AND COALESCE(newer.finished_at, newer.started_at, newer.created_at) > COALESCE(at.finished_at, at.started_at, at.created_at)
          )
        )
      ORDER BY COALESCE(at.finished_at, at.started_at, at.created_at) DESC, at.id DESC
      LIMIT ?`,
      [workspaceId, limit],
    );
  }

  private listWorkerJobs(workspaceId: string, limit: number): WorkerJobQueueRow[] {
    return this.db.all<WorkerJobQueueRow>(
      `SELECT
        worker_jobs.id,
        worker_jobs.workspace_id,
        worker_jobs.status,
        worker_jobs.job_type,
        worker_jobs.target_type,
        worker_jobs.target_id,
        worker_jobs.payload,
        rp.id AS reply_proposal_id,
        rp.status AS reply_proposal_status,
        rp.content AS reply_proposal_content,
        et.id AS reply_thread_id,
        et.status AS reply_thread_status,
        et.channel AS reply_channel,
        et.counterpart_handle AS reply_counterpart_handle,
        rp.account_id AS reply_account_id,
        a.handle AS reply_account_handle,
        worker_jobs.error_code,
        worker_jobs.error_message,
        worker_jobs.created_at,
        worker_jobs.run_after,
        worker_jobs.started_at,
        worker_jobs.lease_expires_at,
        worker_jobs.finished_at
      FROM worker_jobs
      LEFT JOIN engagement_reply_proposals rp ON rp.id = worker_jobs.target_id AND worker_jobs.target_type = 'reply_proposal'
      LEFT JOIN engagement_threads et ON et.id = rp.thread_id
      LEFT JOIN accounts a ON a.id = rp.account_id
      WHERE worker_jobs.workspace_id = ?
        AND worker_jobs.status IN ('queued', 'running', 'failed')
        AND (
          worker_jobs.status = 'failed'
          OR (worker_jobs.status = 'queued' AND datetime(worker_jobs.run_after) <= datetime('now', '-10 minutes'))
          OR (
            worker_jobs.status = 'running'
            AND (
              (worker_jobs.lease_expires_at IS NOT NULL AND datetime(worker_jobs.lease_expires_at) <= datetime('now'))
              OR datetime(worker_jobs.started_at) <= datetime('now', '-15 minutes')
            )
          )
        )
        AND NOT (
          worker_jobs.job_type = 'engagement.reply.execute'
          AND rp.status IN ('rejected', 'sent')
        )
        AND NOT (
          worker_jobs.status = 'failed'
          AND EXISTS (
            SELECT 1
            FROM worker_jobs newer
            WHERE newer.workspace_id = worker_jobs.workspace_id
              AND newer.job_type = worker_jobs.job_type
              AND newer.target_type = worker_jobs.target_type
              AND newer.target_id = worker_jobs.target_id
              AND newer.id <> worker_jobs.id
              AND COALESCE(newer.finished_at, newer.started_at, newer.run_after, newer.created_at) > COALESCE(worker_jobs.finished_at, worker_jobs.started_at, worker_jobs.run_after, worker_jobs.created_at)
          )
        )
      ORDER BY COALESCE(worker_jobs.finished_at, worker_jobs.started_at, worker_jobs.run_after, worker_jobs.created_at) DESC, worker_jobs.id DESC
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
        AND d.status <> 'rejected'
        AND pj.status IN ('queued', 'running', 'failed')
        AND (
          pj.status = 'failed'
          OR (pj.status = 'queued' AND datetime(pj.run_after) <= datetime('now', '-10 minutes'))
          OR (
            pj.status = 'running'
            AND (
              (pj.lease_expires_at IS NOT NULL AND datetime(pj.lease_expires_at) <= datetime('now'))
              OR datetime(pj.started_at) <= datetime('now', '-15 minutes')
            )
          )
        )
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
        AND s.status = 'active'
        AND sfr.status IN ('queued', 'running', 'failed')
        AND (
          sfr.status = 'failed'
          OR (sfr.status = 'queued' AND datetime(sfr.started_at) <= datetime('now', '-10 minutes'))
          OR (
            sfr.status = 'running'
            AND (
              (sfr.lease_expires_at IS NOT NULL AND datetime(sfr.lease_expires_at) <= datetime('now'))
              OR datetime(sfr.started_at) <= datetime('now', '-15 minutes')
            )
          )
        )
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
        SUM(CASE WHEN worker_jobs.status = 'queued' THEN 1 ELSE 0 END) AS queued_count,
        SUM(CASE WHEN worker_jobs.status = 'running' THEN 1 ELSE 0 END) AS running_count,
        SUM(CASE
          WHEN worker_jobs.status = 'failed'
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
        SUM(CASE WHEN worker_jobs.status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_count,
        MIN(CASE WHEN worker_jobs.status = 'queued' THEN worker_jobs.run_after END) AS oldest_queued_at,
        MIN(CASE WHEN worker_jobs.status = 'running' THEN worker_jobs.started_at END) AS oldest_running_started_at,
        MIN(CASE
          WHEN worker_jobs.status = 'failed'
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
          THEN COALESCE(worker_jobs.finished_at, worker_jobs.created_at) END) AS oldest_failed_at
      FROM worker_jobs
      LEFT JOIN engagement_reply_proposals rp ON rp.id = worker_jobs.target_id AND worker_jobs.target_type = 'reply_proposal'
      WHERE worker_jobs.workspace_id = ?
        AND NOT (
          worker_jobs.job_type = 'engagement.reply.execute'
          AND rp.status IN ('rejected', 'sent')
        )`,
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
      INNER JOIN drafts d ON d.id = ps.draft_id
      WHERE ps.workspace_id = ?
        AND d.status <> 'rejected'`,
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
      WHERE s.workspace_id = ?
        AND s.status = 'active'`,
      [workspaceId],
    );

    return mapQueueSummary("source_fetch_run", row);
  }

  private getAccountReadinessSummary(workspaceId: string): MonitoringOperatorQueueKindSummary {
    const row = this.db.get<QueueSummaryRow>(
      `SELECT
        0 AS queued_count,
        0 AS running_count,
        COUNT(*) AS failed_count,
        0 AS cancelled_count,
        MIN(a.updated_at) AS oldest_failed_at
      FROM accounts a
      LEFT JOIN account_credentials ac ON ac.account_id = a.id
      LEFT JOIN personas p ON p.account_id = a.id
      LEFT JOIN autopost_policies ap ON ap.account_id = a.id
      LEFT JOIN engagement_policies ep ON ep.account_id = a.id
      WHERE a.workspace_id = ?
        AND a.status = 'active'
        AND (ap.id IS NOT NULL OR ep.id IS NOT NULL)
        AND (
          ac.id IS NULL
          OR ac.status <> 'valid'
          OR p.id IS NULL
          OR NOT EXISTS (
            SELECT 1 FROM sources active_sources
            WHERE active_sources.account_id = a.id AND active_sources.status = 'active'
          )
          OR NOT EXISTS (
            SELECT 1
            FROM source_documents sd
            INNER JOIN sources source_for_doc ON source_for_doc.id = sd.source_id
            WHERE source_for_doc.account_id = a.id
          )
          OR (ap.id IS NULL AND ep.id IS NULL)
          OR (ap.status = 'paused' AND (ep.id IS NULL OR ep.status = 'paused'))
          OR (ep.status = 'paused' AND (ap.id IS NULL OR ap.status = 'paused'))
        )`,
      [workspaceId],
    );

    return {
      ...mapQueueSummary("account_readiness", row),
      retry_supported_failed_count: 0,
    };
  }

  private getDraftReviewSummary(workspaceId: string): MonitoringOperatorQueueKindSummary {
    const row = this.db.get<QueueSummaryRow>(
      `SELECT
        0 AS queued_count,
        0 AS running_count,
        COUNT(*) AS failed_count,
        0 AS cancelled_count,
        MIN(created_at) AS oldest_failed_at
      FROM drafts
      WHERE workspace_id = ?
        AND status = 'pending'`,
      [workspaceId],
    );

    return {
      ...mapQueueSummary("draft_review", row),
      retry_supported_failed_count: 0,
    };
  }

  private getReplyReviewSummary(workspaceId: string): MonitoringOperatorQueueKindSummary {
    const row = this.db.get<QueueSummaryRow>(
      `SELECT
        0 AS queued_count,
        0 AS running_count,
        COUNT(*) AS failed_count,
        0 AS cancelled_count,
        MIN(created_at) AS oldest_failed_at
      FROM engagement_reply_proposals
      WHERE workspace_id = ?
        AND status IN ('pending_review', 'approved')`,
      [workspaceId],
    );

    return {
      ...mapQueueSummary("reply_review", row),
      retry_supported_failed_count: 0,
    };
  }

  private getRuntimeHealthSummary(): MonitoringOperatorQueueKindSummary {
    const row = this.db.get<QueueSummaryRow>(
      `WITH runtime_health_items AS (
        SELECT strftime('%Y-%m-%dT%H:%M:%fZ', 'now') AS last_heartbeat_at
        WHERE NOT EXISTS (
          SELECT 1
          FROM runtime_processes rp
          WHERE rp.process_type = 'http_server'
            AND rp.status = 'running'
            AND rp.last_heartbeat_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-45 seconds')
        )
        UNION ALL
        SELECT strftime('%Y-%m-%dT%H:%M:%fZ', 'now') AS last_heartbeat_at
        WHERE NOT EXISTS (
          SELECT 1
          FROM runtime_processes rp
          WHERE rp.process_type = 'worker'
            AND rp.status = 'running'
            AND rp.last_heartbeat_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-45 seconds')
        )
        UNION ALL
        SELECT rp.last_heartbeat_at
        FROM runtime_processes rp
        WHERE rp.status = 'running'
          AND rp.last_heartbeat_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-45 seconds')
          AND NOT EXISTS (
            SELECT 1
            FROM runtime_processes fresh
            WHERE fresh.process_type = rp.process_type
              AND fresh.status = 'running'
              AND fresh.last_heartbeat_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-45 seconds')
          )
      )
      SELECT
        0 AS queued_count,
        0 AS running_count,
        COUNT(*) AS failed_count,
        0 AS cancelled_count,
        MIN(last_heartbeat_at) AS oldest_failed_at
      FROM runtime_health_items`,
    );

    return {
      ...mapQueueSummary("runtime_health", row),
      retry_supported_failed_count: 0,
    };
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
        worker_jobs.id,
        worker_jobs.workspace_id,
        worker_jobs.status,
        worker_jobs.job_type,
        worker_jobs.target_type,
        worker_jobs.target_id,
        worker_jobs.payload,
        rp.id AS reply_proposal_id,
        rp.status AS reply_proposal_status,
        rp.content AS reply_proposal_content,
        et.id AS reply_thread_id,
        et.status AS reply_thread_status,
        et.channel AS reply_channel,
        et.counterpart_handle AS reply_counterpart_handle,
        rp.account_id AS reply_account_id,
        a.handle AS reply_account_handle,
        worker_jobs.error_code,
        worker_jobs.error_message,
        worker_jobs.created_at,
        worker_jobs.run_after,
        worker_jobs.started_at,
        worker_jobs.lease_expires_at,
        worker_jobs.finished_at
      FROM worker_jobs
      LEFT JOIN engagement_reply_proposals rp ON rp.id = worker_jobs.target_id AND worker_jobs.target_type = 'reply_proposal'
      LEFT JOIN engagement_threads et ON et.id = rp.thread_id
      LEFT JOIN accounts a ON a.id = rp.account_id
      WHERE worker_jobs.workspace_id = ?
        AND worker_jobs.status = 'failed'
        AND NOT (
          worker_jobs.job_type = 'engagement.reply.execute'
          AND rp.status IN ('rejected', 'sent')
        )
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
      ORDER BY COALESCE(worker_jobs.finished_at, worker_jobs.started_at, worker_jobs.run_after, worker_jobs.created_at) ASC, worker_jobs.id ASC
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
        AND d.status <> 'rejected'
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
        AND s.status = 'active'
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

function mapAccountReadinessRow(row: AccountReadinessQueueRow): MonitoringOperatorQueueItem {
  const reason = resolveAccountReadinessReason(row);
  return {
    kind: "account_readiness",
    id: `readiness:${row.id}:${reason.code}`,
    workspace_id: row.workspace_id,
    account_id: row.id,
    status: "failed",
    title: `账号待补全 · ${row.handle}`,
    subtitle: reason.subtitle,
    blocking_chain: reason.blocking_chain,
    recommended_action: reason.recommended_action,
    target_url: reason.target_url,
    created_at: row.updated_at,
    finished_at: row.updated_at,
    retry_supported: false,
  };
}

function mapDraftReviewRow(row: DraftReviewQueueRow): MonitoringOperatorQueueItem {
  return {
    kind: "draft_review",
    id: `draft_review:${row.account_id}`,
    workspace_id: row.workspace_id,
    account_id: row.account_id,
    status: "failed",
    title: `待审核草稿 · ${row.account_handle}`,
    subtitle: `${row.pending_count} 篇草稿等待人工审核，自动化会先停下来避免继续堆积。`,
    blocking_chain: "内容审核 / 发布链路",
    recommended_action: "进入草稿箱，批准、编辑、拒绝或要求重写这些 pending 草稿。",
    target_url: "/drafts",
    error_category: "operator_required",
    error_user_message: "有草稿等待人工审核，自动化已暂停继续产出以避免积压。",
    retry_advice: "进入草稿箱逐条批准、编辑、拒绝或重新生成；处理完后自动化会继续推进。",
    auto_retry_recommended: false,
    created_at: row.oldest_created_at,
    finished_at: row.newest_updated_at,
    retry_supported: false,
  };
}

function mapReplyReviewRow(row: ReplyReviewQueueRow): MonitoringOperatorQueueItem {
  const pendingReviewCount = row.pending_review_count ?? 0;
  const approvedPendingSendCount = row.approved_pending_send_count ?? 0;
  const subtitleParts = [
    pendingReviewCount > 0 ? `${pendingReviewCount} 条回复提案待审核` : undefined,
    approvedPendingSendCount > 0 ? `${approvedPendingSendCount} 条已批准回复待发送` : undefined,
  ].filter(Boolean);

  return {
    kind: "reply_review",
    id: `reply_review:${row.account_id}`,
    workspace_id: row.workspace_id,
    account_id: row.account_id,
    status: "failed",
    title: `待处理互动回复 · ${row.account_handle}`,
    subtitle: subtitleParts.join("，"),
    blocking_chain: "互动审核 / 发送链路",
    recommended_action: pendingReviewCount > 0
      ? "进入互动页审核回复提案；批准后系统才能继续发送或推进后续互动。"
      : "进入互动页发送已批准回复，或检查发送失败原因。",
    target_url: `/accounts/${row.account_id}/engagement`,
    error_category: "operator_required",
    error_user_message: pendingReviewCount > 0
      ? "有互动回复提案等待人工审核，系统不会自动替你发送。"
      : "有已批准互动回复等待发送，需要进入互动页处理发送状态。",
    retry_advice: pendingReviewCount > 0
      ? "进入互动页批准、编辑或拒绝回复提案。"
      : "进入互动页发送已批准回复；如果发送失败，再查看具体失败原因。",
    auto_retry_recommended: false,
    created_at: row.oldest_created_at,
    finished_at: row.newest_activity_at,
    retry_supported: false,
  };
}

function mapRuntimeHealthRow(row: RuntimeHealthQueueRow, workspaceId: string): MonitoringOperatorQueueItem {
  const reason = resolveRuntimeHealthReason(row);
  const classification = classifyOperatorError({
    status: "failed",
    error_code: row.issue_code,
    error_message: reason.subtitle,
  });
  return {
    kind: "runtime_health",
    id: row.id,
    workspace_id: workspaceId,
    status: "failed",
    title: reason.title,
    subtitle: reason.subtitle,
    blocking_chain: "后台运行时 / 自动化调度链路",
    recommended_action: reason.recommended_action,
    target_url: "/monitoring",
    error_code: row.issue_code,
    error_category: classification?.category,
    error_user_message: classification?.user_message,
    retry_advice: classification?.retry_advice,
    auto_retry_recommended: classification?.auto_retry_recommended,
    created_at: row.last_heartbeat_at,
    finished_at: row.last_heartbeat_at,
    retry_supported: false,
  };
}

function mapAgentTaskRow(row: AgentTaskQueueRow): MonitoringOperatorQueueItem {
  const accountId = row.target_type === "account" ? row.target_id : undefined;
  const classification = classifyOperatorError({
    status: row.status,
    error_code: row.error_code,
    error_message: row.error_message,
  });
  return {
    kind: "agent_task",
    id: row.id,
    workspace_id: row.workspace_id,
    status: row.status,
    title: `${row.agent_code} · ${row.task_type}`,
    subtitle: describeAgentTask(row),
    blocking_chain: resolveAgentTaskChain(row.task_type),
    recommended_action: resolveQueueAction(row.status, classification, accountId ? "查看账号工作台并重试任务" : "查看任务详情并重试"),
    target_url: accountId ? `/accounts/${accountId}/preview` : "/monitoring",
    account_id: accountId,
    error_code: row.error_code ?? undefined,
    error_message: row.error_message ?? undefined,
    error_category: classification?.category,
    error_user_message: classification?.user_message,
    retry_advice: classification?.retry_advice,
    auto_retry_recommended: classification?.auto_retry_recommended,
    created_at: row.created_at,
    started_at: row.started_at ?? undefined,
    lease_expires_at: row.lease_expires_at ?? undefined,
    finished_at: row.finished_at ?? undefined,
    latest_run_id: row.latest_run_id ?? undefined,
    retry_supported: row.status === "failed",
  };
}

function mapWorkerJobRow(row: WorkerJobQueueRow): MonitoringOperatorQueueItem {
  const payload = parseWorkerJobPayload(row.payload);
  const accountId = row.reply_account_id
    || (typeof payload.account_id === "string"
    ? payload.account_id
    : row.target_type === "account"
      ? row.target_id
      : undefined);
  const classification = classifyOperatorError({
    status: row.status,
    error_code: row.error_code,
    error_message: row.error_message,
  });
  const isReplyExecute = row.job_type === "engagement.reply.execute" && row.reply_proposal_id;
  return {
    kind: "worker_job",
    id: row.id,
    workspace_id: row.workspace_id,
    status: row.status,
    title: isReplyExecute ? `互动回复发送 · ${row.reply_account_handle ?? "未知账号"}` : `worker · ${row.job_type}`,
    subtitle: isReplyExecute ? describeReplyExecuteJob(row) : describeWorkerJob(row, accountId),
    blocking_chain: resolveWorkerJobChain(row.job_type),
    recommended_action: isReplyExecute
      ? resolveReplyExecuteAction(row, classification)
      : resolveQueueAction(row.status, classification, accountId ? "查看账号自动化状态并重试 job" : "查看 worker job 并重试"),
    target_url: accountId ? `/accounts/${accountId}/${isReplyExecute ? "engagement" : "preview"}` : "/monitoring",
    account_id: accountId,
    error_code: row.error_code ?? undefined,
    error_message: row.error_message ?? undefined,
    error_category: classification?.category,
    error_user_message: classification?.user_message,
    retry_advice: classification?.retry_advice,
    auto_retry_recommended: classification?.auto_retry_recommended,
    created_at: row.created_at,
    run_after: row.run_after,
    started_at: row.started_at ?? undefined,
    lease_expires_at: row.lease_expires_at ?? undefined,
    finished_at: row.finished_at ?? undefined,
    retry_supported: row.status === "failed",
  };
}

function mapPublishJobRow(row: PublishJobQueueRow): MonitoringOperatorQueueItem {
  const classification = classifyOperatorError({
    status: row.status,
    error_code: row.error_code,
    error_message: row.error_message,
  });
  return {
    kind: "publish_job",
    id: row.id,
    workspace_id: row.workspace_id,
    account_id: row.account_id,
    status: row.status,
    title: `publish · ${row.account_handle}`,
    subtitle: row.draft_topic,
    blocking_chain: "发布链路",
    recommended_action: resolveQueueAction(row.status, classification, "查看草稿和排程，修复后重试发布"),
    target_url: `/drafts`,
    error_code: row.error_code ?? undefined,
    error_message: row.error_message ?? undefined,
    error_category: classification?.category,
    error_user_message: classification?.user_message,
    retry_advice: classification?.retry_advice,
    auto_retry_recommended: classification?.auto_retry_recommended,
    created_at: row.created_at,
    run_after: row.run_after,
    started_at: row.started_at ?? undefined,
    lease_expires_at: row.lease_expires_at ?? undefined,
    finished_at: row.finished_at ?? undefined,
    retry_supported: row.status === "failed",
  };
}

function mapSourceFetchRunRow(row: SourceFetchQueueRow): MonitoringOperatorQueueItem {
  const classification = classifyOperatorError({
    status: row.status,
    error_code: row.error_code,
    error_message: row.error_message,
  });
  return {
    kind: "source_fetch_run",
    id: row.id,
    workspace_id: row.workspace_id,
    account_id: row.account_id,
    status: row.status,
    title: `source fetch · ${row.source_name}`,
    subtitle: `${row.source_type} · ${row.account_handle}`,
    blocking_chain: "信息源抓取链路",
    recommended_action: resolveQueueAction(row.status, classification, "打开账号信息源页，检查 URL / 凭证 / 抓取结果后重试"),
    target_url: `/accounts/${row.account_id}/sources`,
    error_code: row.error_code ?? undefined,
    error_message: row.error_message ?? undefined,
    error_category: classification?.category,
    error_user_message: classification?.user_message,
    retry_advice: classification?.retry_advice,
    auto_retry_recommended: classification?.auto_retry_recommended,
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

function resolveAccountReadinessReason(row: AccountReadinessQueueRow): {
  code: string;
  subtitle: string;
  blocking_chain: string;
  recommended_action: string;
  target_url: string;
} {
  if (!row.credential_status) {
    return {
      code: "credential_missing",
      subtitle: "未绑定账号凭证，自动发帖、互动和资料同步都无法执行。",
      blocking_chain: "凭证 / 发布 / 互动链路",
      recommended_action: "重新绑定账号凭证，并完成凭证校验。",
      target_url: `/accounts/${row.id}/preview`,
    };
  }

  if (row.credential_status !== "valid") {
    return {
      code: "credential_invalid",
      subtitle: `账号凭证状态为 ${row.credential_status}，需要重新校验或重新绑定。`,
      blocking_chain: "凭证 / 发布 / 互动链路",
      recommended_action: "重新校验凭证；如果仍失败，重新绑定账号。",
      target_url: `/accounts/${row.id}/preview`,
    };
  }

  if (!row.persona_id) {
    return {
      code: "persona_missing",
      subtitle: "尚未配置人格，内容生成缺少稳定风格边界。",
      blocking_chain: "内容生成链路",
      recommended_action: "进入人格页补全 persona，或应用已有模板。",
      target_url: `/accounts/${row.id}/persona`,
    };
  }

  if ((row.active_source_count ?? 0) === 0) {
    return {
      code: "source_missing",
      subtitle: "没有启用中的信息源，系统无法自动提取信号和生成 brief。",
      blocking_chain: "信息源 / 趋势 / 内容 brief 链路",
      recommended_action: "进入信息源页添加或启用 source。",
      target_url: `/accounts/${row.id}/sources`,
    };
  }

  if ((row.recent_document_count ?? 0) === 0) {
    return {
      code: "source_no_documents",
      subtitle: "已有启用信息源，但还没有抓到任何文档。",
      blocking_chain: "信息源 / 趋势 / 内容 brief 链路",
      recommended_action: "进入信息源页检查抓取状态；必要时手动刷新或修正 URL。",
      target_url: `/accounts/${row.id}/sources`,
    };
  }

  if (!row.autopost_status && !row.engagement_status) {
    return {
      code: "policy_missing",
      subtitle: "未配置自动发帖或互动策略，账号不会进入自动化运营。",
      blocking_chain: "账号自动化编排链路",
      recommended_action: "至少配置一个自动发帖或互动策略。",
      target_url: `/accounts/${row.id}/autopost`,
    };
  }

  return {
    code: "policy_paused",
    subtitle: "自动化策略已配置但当前处于暂停状态。",
    blocking_chain: "账号自动化编排链路",
    recommended_action: "恢复自动发帖或互动策略，让账号重新进入自动化池。",
    target_url: row.autopost_status === "paused" ? `/accounts/${row.id}/autopost` : `/accounts/${row.id}/engagement`,
  };
}

function resolveRuntimeHealthReason(row: RuntimeHealthQueueRow): {
  title: string;
  subtitle: string;
  recommended_action: string;
} {
  if (row.issue_code === "http_server_missing") {
    return {
      title: "HTTP 后端心跳缺失",
      subtitle: "没有检测到健康的 http_server heartbeat，前端可能无法稳定连接后端。",
      recommended_action: "进入监控中心确认 backend-http 容器状态；如无心跳，重启 backend-http 并观察 heartbeat 是否恢复。",
    };
  }

  if (row.issue_code === "worker_missing") {
    return {
      title: "后台 worker 心跳缺失",
      subtitle: "没有检测到健康的 worker heartbeat，自动抓取、生成、发布和互动任务不会继续推进。",
      recommended_action: "进入监控中心确认 backend-worker 容器状态；如无心跳，重启 backend-worker 并检查运行日志。",
    };
  }

  const processName = row.process_name ?? row.process_type ?? "runtime process";
  const heartbeatAge = typeof row.heartbeat_age_seconds === "number" && Number.isFinite(row.heartbeat_age_seconds)
    ? `${Math.max(0, Math.round(row.heartbeat_age_seconds))} 秒`
    : "超过 45 秒";

  return {
    title: `运行时心跳过期 · ${processName}`,
    subtitle: `${processName} 已 ${heartbeatAge} 没有更新 heartbeat，可能卡死或已经掉线。`,
    recommended_action: "进入监控中心查看最近运行事件和容器日志；确认无恢复后重启对应进程。",
  };
}

function describeAgentTask(row: AgentTaskQueueRow): string {
  if (row.target_type === "account") {
    return `账号任务 · ${row.target_id}`;
  }

  if (row.target_type === "draft") {
    return `草稿任务 · ${row.target_id}`;
  }

  return `${row.target_type} / ${row.target_id}`;
}

function describeWorkerJob(row: WorkerJobQueueRow, accountId: string | undefined): string {
  if (accountId) {
    return `账号调度 · ${accountId}`;
  }

  return `${row.target_type} / ${row.target_id}`;
}

function describeReplyExecuteJob(row: WorkerJobQueueRow): string {
  const parts = [
    `proposal ${row.reply_proposal_id}`,
    row.reply_proposal_status ? `状态 ${row.reply_proposal_status}` : undefined,
    row.reply_channel ? `渠道 ${row.reply_channel}` : undefined,
    row.reply_counterpart_handle ? `对象 @${row.reply_counterpart_handle.replace(/^@/, "")}` : undefined,
  ].filter((value): value is string => Boolean(value));
  const contentPreview = row.reply_proposal_content?.trim()
    ? ` · ${row.reply_proposal_content.trim().slice(0, 80)}`
    : "";

  return `${parts.join(" · ")}${contentPreview}`;
}

function resolveReplyExecuteAction(
  row: WorkerJobQueueRow,
  classification: ReturnType<typeof classifyOperatorError>,
): string {
  if (row.reply_proposal_status === "pending_review") {
    return "这条互动回复还在待审核，不能直接发送；进入账号互动页先批准、拒绝或编辑后再发送。";
  }

  if (row.reply_proposal_status === "approved") {
    return resolveQueueAction(row.status, classification, "进入账号互动页查看这条已批准回复；确认内容和目标会话后再重新发送");
  }

  if (!row.reply_proposal_status) {
    return resolveQueueAction(row.status, classification, "找不到对应 reply proposal，进入监控中心确认是否是已删除或历史脏数据");
  }

  return resolveQueueAction(
    row.status,
    classification,
    `当前 proposal 状态为 ${row.reply_proposal_status}，进入账号互动页确认是否还需要处理`,
  );
}

function resolveAgentTaskChain(taskType: string): string {
  if (taskType.includes("draft")) {
    return "内容草稿链路";
  }

  if (taskType.includes("brief")) {
    return "内容 brief 链路";
  }

  if (taskType.includes("inbox") || taskType.includes("engagement")) {
    return "互动链路";
  }

  if (taskType.includes("persona")) {
    return "人格配置链路";
  }

  return "Agent 执行链路";
}

function resolveWorkerJobChain(jobType: string): string {
  if (jobType.includes("source") || jobType.includes("mentions") || jobType.includes("dm")) {
    return "信息源 / 互动抓取链路";
  }

  if (jobType.includes("autopost") || jobType.includes("recurring_brief") || jobType.includes("orchestration")) {
    return "账号自动化编排链路";
  }

  if (jobType.includes("engagement")) {
    return "互动执行链路";
  }

  return "Worker 执行链路";
}

function resolveQueueAction(
  status: MonitoringOperatorQueueItem["status"],
  classification: ReturnType<typeof classifyOperatorError>,
  fallback: string,
): string {
  if (status === "failed") {
    if (!classification) {
      return fallback;
    }

    return `${fallback}；${classification.user_message}${classification.retry_advice ? ` ${classification.retry_advice}` : ""}`;
  }

  if (status === "running") {
    return "等待 worker 完成；如果长时间不动，查看监控中心的租约和 worker 心跳。";
  }

  if (status === "queued") {
    return "等待后台 worker 自动执行；如果积压变长，检查 worker 心跳和队列健康。";
  }

  return "查看上下文，确认是否需要重新发起。";
}

function parseWorkerJobPayload(payload: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(payload);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}
