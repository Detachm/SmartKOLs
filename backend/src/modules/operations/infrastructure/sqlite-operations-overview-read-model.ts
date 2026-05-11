import type {
  OperationsOverviewResponse,
  OperationsProcessItem,
  OperationsQueueMetricItem,
  OperationsRuntimeEventItem,
  OperationsSecretInventoryItem,
} from "../../../contracts/api/operations";
import type { SqliteExecutor } from "../../../infrastructure/db/sqlite-executor";
import type { OperationsOverviewReadModel } from "../application/ports/operations-overview-read-model";

interface RuntimeProcessRow {
  id: string;
  process_type: "http_server" | "worker";
  process_name: string;
  pid: number;
  hostname: string;
  status: "running" | "stopped";
  metadata_json: string;
  started_at: string;
  last_heartbeat_at: string;
  stopped_at?: string | null;
}

interface QueueMetricRow {
  queued_count: number | null;
  running_count: number | null;
  failed_count: number | null;
  stale_lease_count: number | null;
  oldest_queued_at?: string | null;
  oldest_running_started_at?: string | null;
}

interface RuntimeEventRow {
  id: string;
  workspace_id?: string | null;
  request_id?: string | null;
  process_id?: string | null;
  severity: "info" | "warning" | "critical";
  event_type: string;
  source_type: string;
  source_id?: string | null;
  message: string;
  payload_json?: string | null;
  created_at: string;
}

interface SecretInventoryRow {
  namespace: string;
  kind: string;
  item_count: number;
}

export class SqliteOperationsOverviewReadModel implements OperationsOverviewReadModel {
  constructor(private readonly db: SqliteExecutor) {}

  async getOverview(input: {
    event_limit: number;
    checked_at: string;
    stale_after_ms: number;
    recent_critical_event_window_ms: number;
  }): Promise<OperationsOverviewResponse> {
    const checkedAtMs = Date.parse(input.checked_at);
    const staleCutoff = new Date(checkedAtMs - input.stale_after_ms).toISOString();
    const recentCriticalCutoff = new Date(checkedAtMs - input.recent_critical_event_window_ms).toISOString();

    const processRows = this.db.all<RuntimeProcessRow>(
      `SELECT id, process_type, process_name, pid, hostname, status, metadata_json, started_at, last_heartbeat_at, stopped_at
      FROM runtime_processes
      ORDER BY CASE status WHEN 'running' THEN 0 ELSE 1 END, last_heartbeat_at DESC
      LIMIT 20`,
    );

    const processes = processRows.map((row) => mapProcess(row, staleCutoff, checkedAtMs));
    const queueMetrics: OperationsQueueMetricItem[] = [
      this.getQueueMetric(
        "agent_task",
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
          SUM(CASE WHEN status = 'running' AND lease_expires_at IS NOT NULL AND lease_expires_at < ? THEN 1 ELSE 0 END) AS stale_lease_count,
          MIN(CASE WHEN status = 'queued' THEN created_at END) AS oldest_queued_at,
          MIN(CASE WHEN status = 'running' THEN started_at END) AS oldest_running_started_at
        FROM agent_tasks`,
        [input.checked_at],
      ),
      this.getQueueMetric(
        "worker_job",
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
          SUM(CASE WHEN status = 'running' AND lease_expires_at IS NOT NULL AND lease_expires_at < ? THEN 1 ELSE 0 END) AS stale_lease_count,
          MIN(CASE WHEN status = 'queued' THEN run_after END) AS oldest_queued_at,
          MIN(CASE WHEN status = 'running' THEN started_at END) AS oldest_running_started_at
        FROM worker_jobs`,
        [input.checked_at],
      ),
      this.getQueueMetric(
        "publish_job",
        `SELECT
          SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) AS queued_count,
          SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) AS running_count,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_count,
          SUM(CASE WHEN status = 'running' AND finished_at IS NULL AND started_at IS NOT NULL AND started_at < ? THEN 1 ELSE 0 END) AS stale_lease_count,
          MIN(CASE WHEN status = 'queued' THEN run_after END) AS oldest_queued_at,
          MIN(CASE WHEN status = 'running' THEN started_at END) AS oldest_running_started_at
        FROM publish_jobs`,
        [staleCutoff],
      ),
      this.getQueueMetric(
        "source_fetch_run",
        `SELECT
          SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) AS queued_count,
          SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) AS running_count,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_count,
          SUM(CASE WHEN status = 'running' AND lease_expires_at IS NOT NULL AND lease_expires_at < ? THEN 1 ELSE 0 END) AS stale_lease_count,
          MIN(CASE WHEN status = 'queued' THEN started_at END) AS oldest_queued_at,
          MIN(CASE WHEN status = 'running' THEN started_at END) AS oldest_running_started_at
        FROM source_fetch_runs`,
        [input.checked_at],
      ),
    ];

    const recentEvents = this.db.all<RuntimeEventRow>(
      `SELECT id, workspace_id, request_id, process_id, severity, event_type, source_type, source_id, message, payload_json, created_at
      FROM runtime_events
      ORDER BY created_at DESC
      LIMIT ?`,
      [input.event_limit],
    ).map((row) => ({
      id: row.id,
      workspace_id: row.workspace_id ?? undefined,
      request_id: row.request_id ?? undefined,
      process_id: row.process_id ?? undefined,
      severity: row.severity,
      event_type: row.event_type,
      source_type: row.source_type,
      source_id: row.source_id ?? undefined,
      message: row.message,
      payload_json: row.payload_json ?? undefined,
      created_at: row.created_at,
    }));

    const secretInventory = this.db.all<SecretInventoryRow>(
      `SELECT namespace, kind, COUNT(*) AS item_count
      FROM managed_secrets
      GROUP BY namespace, kind
      ORDER BY namespace ASC, kind ASC`,
    ).map((row) => ({
      namespace: row.namespace,
      kind: row.kind,
      item_count: row.item_count,
    }));

    const activeHttpServers = processes.filter((item) => item.process_type === "http_server" && item.health_status === "running").length;
    const activeWorkers = processes.filter((item) => item.process_type === "worker" && item.health_status === "running").length;
    const hasFreshHttpServer = processes.some((item) => item.process_type === "http_server" && item.health_status === "running");
    const hasFreshWorker = processes.some((item) => item.process_type === "worker" && item.health_status === "running");
    const staleProcesses = processes.filter((item) => {
      if (item.health_status !== "stale") {
        return false;
      }

      return item.process_type === "http_server" ? !hasFreshHttpServer : !hasFreshWorker;
    }).length;
    const recentCriticalEvents = recentEvents.filter((item) => item.severity === "critical" && item.created_at >= recentCriticalCutoff).length;
    const managedSecretItems = secretInventory.reduce((sum, item) => sum + item.item_count, 0);
    const queuedJobs = queueMetrics.reduce((sum, item) => sum + item.queued_count, 0);
    const runningJobs = queueMetrics.reduce((sum, item) => sum + item.running_count, 0);
    const failedJobs = queueMetrics.reduce((sum, item) => sum + item.failed_count, 0);
    const reasons: string[] = [];

    if (activeHttpServers === 0) {
      reasons.push("no running http_server heartbeat found");
    }
    if (activeWorkers === 0) {
      reasons.push("no running worker heartbeat found");
    }
    if (staleProcesses > 0) {
      reasons.push(`${staleProcesses} runtime process heartbeats are stale`);
    }
    if (failedJobs > 0) {
      reasons.push(`${failedJobs} queue items are failed and require operator action`);
    }
    if (recentCriticalEvents > 0) {
      reasons.push(`${recentCriticalEvents} recent critical runtime events were recorded`);
    }

    const healthStatus = activeHttpServers === 0 || activeWorkers === 0 || staleProcesses > 0
      ? "unhealthy"
      : failedJobs > 0 || recentCriticalEvents > 0
        ? "degraded"
        : "healthy";

    return {
      summary: {
        checked_at: input.checked_at,
        health_status: healthStatus,
        reasons,
        active_processes: processes.filter((item) => item.health_status === "running").length,
        active_http_servers: activeHttpServers,
        active_workers: activeWorkers,
        stale_processes: staleProcesses,
        recent_critical_events: recentCriticalEvents,
        managed_secret_items: managedSecretItems,
        queued_jobs: queuedJobs,
        running_jobs: runningJobs,
        failed_jobs: failedJobs,
      },
      processes,
      queue_metrics: queueMetrics,
      recent_events: recentEvents,
      secret_inventory: secretInventory,
    };
  }

  private getQueueMetric(
    kind: OperationsQueueMetricItem["kind"],
    sql: string,
    params: unknown[],
  ): OperationsQueueMetricItem {
    const row = this.db.get<QueueMetricRow>(sql, params);
    return {
      kind,
      queued_count: row?.queued_count ?? 0,
      running_count: row?.running_count ?? 0,
      failed_count: row?.failed_count ?? 0,
      stale_lease_count: row?.stale_lease_count ?? 0,
      oldest_queued_at: row?.oldest_queued_at ?? undefined,
      oldest_running_started_at: row?.oldest_running_started_at ?? undefined,
    };
  }
}

function mapProcess(row: RuntimeProcessRow, staleCutoff: string, checkedAtMs: number): OperationsProcessItem {
  let metadata: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(row.metadata_json);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      metadata = parsed as Record<string, unknown>;
    }
  } catch {
    metadata = {};
  }

  const heartbeatAgeSeconds = Math.max(0, Math.floor((checkedAtMs - Date.parse(row.last_heartbeat_at)) / 1000));
  const healthStatus = row.status === "stopped"
    ? "stopped"
    : row.last_heartbeat_at < staleCutoff
      ? "stale"
      : "running";

  return {
    id: row.id,
    process_type: row.process_type,
    process_name: row.process_name,
    pid: row.pid,
    hostname: row.hostname,
    status: row.status,
    health_status: healthStatus,
    heartbeat_age_seconds: heartbeatAgeSeconds,
    metadata,
    started_at: row.started_at,
    last_heartbeat_at: row.last_heartbeat_at,
    stopped_at: row.stopped_at ?? undefined,
  };
}
