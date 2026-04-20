import type { MonitoringAgentTraceSummary } from "../../../contracts/api/monitoring";
import type { SqliteStatementExecutor } from "../../../infrastructure/db/sqlite-executor";
import type { AgentRunStatus } from "../../agent-runtime/domain/agent-run";
import type { AgentTaskStatus } from "../../agent-runtime/domain/agent-task";
import type { ModelRequestStatus } from "../../agent-runtime/domain/model-request";
import type { MonitoringAgentTraceReadModel } from "../application/queries/get-monitoring-overview";

interface MonitoringAgentTraceRow {
  task_id: string;
  agent_code: string;
  task_type: string;
  target_type: string;
  target_id: string;
  task_status: AgentTaskStatus;
  task_error_code?: string | null;
  task_error_message?: string | null;
  task_created_at: string;
  task_started_at?: string | null;
  task_finished_at?: string | null;
  run_id?: string | null;
  run_request_id?: string | null;
  run_no?: number | null;
  run_model_name?: string | null;
  run_status?: AgentRunStatus | null;
  run_error_code?: string | null;
  run_error_message?: string | null;
  run_started_at?: string | null;
  run_finished_at?: string | null;
  model_request_id?: string | null;
  model_request_provider?: string | null;
  model_request_model_name?: string | null;
  model_request_status?: ModelRequestStatus | null;
  model_request_prompt_artifact_ref?: string | null;
  model_request_tool_spec_ref?: string | null;
  model_request_started_at?: string | null;
  model_request_finished_at?: string | null;
  tool_call_count: number;
  alert_count: number;
  audit_log_count: number;
  connector_request_count: number;
}

export class SqliteMonitoringAgentTraceReadModel implements MonitoringAgentTraceReadModel {
  constructor(private readonly db: SqliteStatementExecutor) {}

  async listByWorkspaceId(workspaceId: string, limit: number): Promise<MonitoringAgentTraceSummary[]> {
    const rows = this.db.all<MonitoringAgentTraceRow>(
      `WITH latest_runs AS (
        SELECT ar.*
        FROM agent_runs ar
        INNER JOIN (
          SELECT task_id, MAX(run_no) AS max_run_no
          FROM agent_runs
          GROUP BY task_id
        ) latest ON latest.task_id = ar.task_id AND latest.max_run_no = ar.run_no
      )
      SELECT
        at.id AS task_id,
        ad.code AS agent_code,
        at.task_type,
        at.target_type,
        at.target_id,
        at.status AS task_status,
        at.error_code AS task_error_code,
        at.error_message AS task_error_message,
        at.created_at AS task_created_at,
        at.started_at AS task_started_at,
        at.finished_at AS task_finished_at,
        lr.id AS run_id,
        lr.request_id AS run_request_id,
        lr.run_no AS run_no,
        lr.model_name AS run_model_name,
        lr.status AS run_status,
        lr.error_code AS run_error_code,
        lr.error_message AS run_error_message,
        lr.started_at AS run_started_at,
        lr.finished_at AS run_finished_at,
        mr.id AS model_request_id,
        mr.provider AS model_request_provider,
        mr.model_name AS model_request_model_name,
        mr.status AS model_request_status,
        mr.prompt_artifact_ref AS model_request_prompt_artifact_ref,
        mr.tool_spec_ref AS model_request_tool_spec_ref,
        mr.started_at AS model_request_started_at,
        mr.finished_at AS model_request_finished_at,
        COALESCE((
          SELECT COUNT(*)
          FROM tool_calls tc
          WHERE tc.agent_run_id = lr.id
        ), 0) AS tool_call_count,
        COALESCE((
          SELECT COUNT(*)
          FROM alerts a
          WHERE a.request_id = COALESCE(lr.request_id, mr.request_id)
        ), 0) AS alert_count,
        COALESCE((
          SELECT COUNT(*)
          FROM audit_logs al
          WHERE al.request_id = COALESCE(lr.request_id, mr.request_id)
        ), 0) AS audit_log_count,
        COALESCE((
          SELECT COUNT(*)
          FROM connector_requests cr
          WHERE cr.request_id = COALESCE(lr.request_id, mr.request_id)
        ), 0) AS connector_request_count
      FROM agent_tasks at
      INNER JOIN agent_definitions ad ON ad.id = at.agent_definition_id
      LEFT JOIN latest_runs lr ON lr.task_id = at.id
      LEFT JOIN model_requests mr ON mr.id = (
        SELECT inner_mr.id
        FROM model_requests inner_mr
        WHERE inner_mr.agent_run_id = lr.id
        ORDER BY inner_mr.started_at DESC, inner_mr.id DESC
        LIMIT 1
      )
      WHERE at.workspace_id = ?
        AND ad.code IN ('brief-builder', 'writer', 'reviewer')
      ORDER BY COALESCE(lr.started_at, at.started_at, at.created_at) DESC, at.created_at DESC, at.id DESC
      LIMIT ?`,
      [workspaceId, limit],
    );

    return rows.map(mapMonitoringAgentTraceRow);
  }
}

function mapMonitoringAgentTraceRow(row: MonitoringAgentTraceRow): MonitoringAgentTraceSummary {
  return {
    task: {
      id: row.task_id,
      agent_code: row.agent_code,
      task_type: row.task_type,
      target_type: row.target_type,
      target_id: row.target_id,
      status: row.task_status,
      error_code: row.task_error_code ?? undefined,
      error_message: row.task_error_message ?? undefined,
      created_at: row.task_created_at,
      started_at: row.task_started_at ?? undefined,
      finished_at: row.task_finished_at ?? undefined,
    },
    run: mapRun(row),
    model_request: mapModelRequest(row),
    stats: {
      tool_call_count: row.tool_call_count,
      alert_count: row.alert_count,
      audit_log_count: row.audit_log_count,
      connector_request_count: row.connector_request_count,
    },
  };
}

function mapRun(row: MonitoringAgentTraceRow): MonitoringAgentTraceSummary["run"] {
  if (!row.run_id || !row.run_status || !row.run_model_name || row.run_no === null || row.run_no === undefined || !row.run_started_at) {
    return undefined;
  }

  return {
    id: row.run_id,
    request_id: row.run_request_id ?? undefined,
    run_no: row.run_no,
    model_name: row.run_model_name,
    status: row.run_status,
    error_code: row.run_error_code ?? undefined,
    error_message: row.run_error_message ?? undefined,
    started_at: row.run_started_at,
    finished_at: row.run_finished_at ?? undefined,
  };
}

function mapModelRequest(row: MonitoringAgentTraceRow): MonitoringAgentTraceSummary["model_request"] {
  if (!row.model_request_id || !row.model_request_provider || !row.model_request_model_name || !row.model_request_status || !row.model_request_started_at) {
    return undefined;
  }

  return {
    id: row.model_request_id,
    provider: row.model_request_provider,
    model_name: row.model_request_model_name,
    status: row.model_request_status,
    prompt_artifact_ref: row.model_request_prompt_artifact_ref ?? undefined,
    tool_spec_ref: row.model_request_tool_spec_ref ?? undefined,
    started_at: row.model_request_started_at,
    finished_at: row.model_request_finished_at ?? undefined,
  };
}
