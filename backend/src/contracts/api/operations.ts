export interface OperationsProcessItem {
  id: string;
  process_type: "http_server" | "worker";
  process_name: string;
  pid: number;
  hostname: string;
  status: "running" | "stopped";
  health_status: "running" | "stopped" | "stale";
  heartbeat_age_seconds: number;
  metadata: Record<string, unknown>;
  started_at: string;
  last_heartbeat_at: string;
  stopped_at?: string;
}

export interface OperationsQueueMetricItem {
  kind: "agent_task" | "worker_job" | "publish_job" | "source_fetch_run";
  queued_count: number;
  running_count: number;
  failed_count: number;
  stale_lease_count: number;
  oldest_queued_at?: string;
  oldest_running_started_at?: string;
}

export interface OperationsRuntimeEventItem {
  id: string;
  workspace_id?: string;
  request_id?: string;
  process_id?: string;
  severity: "info" | "warning" | "critical";
  event_type: string;
  source_type: string;
  source_id?: string;
  message: string;
  payload_json?: string;
  created_at: string;
}

export interface OperationsSecretInventoryItem {
  namespace: string;
  kind: string;
  item_count: number;
}

export interface OperationsOverviewResponse {
  summary: {
    checked_at: string;
    health_status: "healthy" | "degraded" | "unhealthy";
    reasons: string[];
    active_processes: number;
    active_http_servers: number;
    active_workers: number;
    stale_processes: number;
    recent_critical_events: number;
    managed_secret_items: number;
    queued_jobs: number;
    running_jobs: number;
    failed_jobs: number;
  };
  processes: OperationsProcessItem[];
  queue_metrics: OperationsQueueMetricItem[];
  recent_events: OperationsRuntimeEventItem[];
  secret_inventory: OperationsSecretInventoryItem[];
}

export interface OperationsHealthResponse {
  checked_at: string;
  health_status: "healthy" | "degraded" | "unhealthy";
  reasons: string[];
  active_http_servers: number;
  active_workers: number;
  stale_processes: number;
  failed_jobs: number;
}

export interface CleanupStaleRuntimeProcessesRequest {
  stale_after_ms?: number;
  limit?: number;
}

export interface CleanupStaleRuntimeProcessesResponse {
  checked_at: string;
  stale_before: string;
  matched_count: number;
  updated_count: number;
  process_ids: string[];
}
