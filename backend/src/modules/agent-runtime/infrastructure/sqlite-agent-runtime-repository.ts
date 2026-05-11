import type { SqliteExecutor } from "../../../infrastructure/db/sqlite-executor";
import type { RequestContextStore } from "../../../core/request-context/request-context";
import type { AgentRuntimeRepository } from "../application/ports/agent-runtime-repository";
import type { AgentDefinition } from "../domain/agent-definition";
import type { AgentTask } from "../domain/agent-task";
import type { AgentRun } from "../domain/agent-run";
import type { ModelRequest } from "../domain/model-request";
import type { ModelRequestAttempt } from "../domain/model-request-attempt";
import type { ToolCall } from "../domain/tool-call";

export class SqliteAgentRuntimeRepository implements AgentRuntimeRepository {
  constructor(
    private readonly db: SqliteExecutor,
    private readonly requestContext: RequestContextStore,
  ) {}

  async findDefinitionById(definitionId: string): Promise<AgentDefinition | null> {
    return this.db.get<AgentDefinition>(
      `SELECT id, code, name, version, input_schema, output_schema, tool_policy, is_active
      FROM agent_definitions
      WHERE id = ?`,
      [definitionId],
    );
  }

  async findDefinitionByCode(code: string): Promise<AgentDefinition | null> {
    return this.db.get<AgentDefinition>(
      `SELECT id, code, name, version, input_schema, output_schema, tool_policy, is_active
      FROM agent_definitions
      WHERE code = ? AND is_active = 1`,
      [code],
    );
  }

  async createDefinition(definition: AgentDefinition): Promise<void> {
    this.db.run(
      `INSERT INTO agent_definitions (
        id, code, name, version, input_schema, output_schema, tool_policy, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        definition.id,
        definition.code,
        definition.name,
        definition.version,
        definition.input_schema,
        definition.output_schema,
        definition.tool_policy,
        definition.is_active ? 1 : 0,
      ],
    );
  }

  async findTaskById(taskId: string): Promise<AgentTask | null> {
    return this.db.get<AgentTask>(
      `SELECT
        id, workspace_id, agent_definition_id, task_type, target_type, target_id, payload, status,
        error_code, error_message, started_at, lease_expires_at, finished_at, created_at
      FROM agent_tasks
      WHERE id = ?`,
      [taskId],
    );
  }

  async listTasksByWorkspaceAndStatus(workspaceId: string, status: AgentTask["status"], limit: number): Promise<AgentTask[]> {
    return this.db.all<AgentTask>(
      `SELECT
        id, workspace_id, agent_definition_id, task_type, target_type, target_id, payload, status,
        error_code, error_message, started_at, lease_expires_at, finished_at, created_at
      FROM agent_tasks
      WHERE workspace_id = ? AND status = ?
      ORDER BY COALESCE(finished_at, started_at, created_at) ASC, id ASC
      LIMIT ?`,
      [workspaceId, status, limit],
    );
  }

  async claimNextQueuedTask(startedAt: string, leaseExpiresAt: string): Promise<AgentTask | null> {
    return this.db.transaction((tx) => {
      const task = tx.get<AgentTask>(
        `SELECT
          id, workspace_id, agent_definition_id, task_type, target_type, target_id, payload, status,
          error_code, error_message, started_at, lease_expires_at, finished_at, created_at
        FROM agent_tasks
        WHERE status = 'queued'
        ORDER BY created_at ASC
        LIMIT 1`,
      );

      if (!task) {
        return null;
      }

      const claimed = tx.run(
        `UPDATE agent_tasks
        SET status = 'running', error_code = NULL, error_message = NULL, started_at = ?, lease_expires_at = ?, finished_at = NULL
        WHERE id = ? AND status = 'queued'`,
        [startedAt, leaseExpiresAt, task.id],
      );

      if (claimed.changes !== 1) {
        return null;
      }

      return {
        ...task,
        status: "running" as const,
        error_code: undefined,
        error_message: undefined,
        started_at: startedAt,
        lease_expires_at: leaseExpiresAt,
        finished_at: undefined,
      };
    });
  }

  async listExpiredRunningTasks(now: string, limit: number): Promise<AgentTask[]> {
    return this.db.all<AgentTask>(
      `SELECT
        id, workspace_id, agent_definition_id, task_type, target_type, target_id, payload, status,
        error_code, error_message, started_at, lease_expires_at, finished_at, created_at
      FROM agent_tasks
      WHERE status = 'running' AND lease_expires_at IS NOT NULL AND lease_expires_at <= ?
      ORDER BY lease_expires_at ASC
      LIMIT ?`,
      [now, limit],
    );
  }

  async createTask(task: AgentTask): Promise<void> {
    this.db.run(
      `INSERT INTO agent_tasks (
        id, workspace_id, agent_definition_id, task_type, target_type, target_id, payload, status,
        error_code, error_message, started_at, lease_expires_at, finished_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        task.id,
        task.workspace_id,
        task.agent_definition_id,
        task.task_type,
        task.target_type,
        task.target_id,
        task.payload,
        task.status,
        task.error_code ?? null,
        task.error_message ?? null,
        task.started_at ?? null,
        task.lease_expires_at ?? null,
        task.finished_at ?? null,
        task.created_at,
      ],
    );
  }

  async saveTask(task: AgentTask): Promise<void> {
    this.db.run(
      `UPDATE agent_tasks
      SET status = ?, payload = ?, error_code = ?, error_message = ?, started_at = ?, lease_expires_at = ?, finished_at = ?
      WHERE id = ?`,
      [
        task.status,
        task.payload,
        task.error_code ?? null,
        task.error_message ?? null,
        task.started_at ?? null,
        task.lease_expires_at ?? null,
        task.finished_at ?? null,
        task.id,
      ],
    );
  }

  async findRunById(runId: string): Promise<AgentRun | null> {
    return this.db.get<AgentRun>(
      `SELECT
        id, task_id, request_id, run_no, model_name, status, output, error_code, error_message, started_at, finished_at
      FROM agent_runs
      WHERE id = ?`,
      [runId],
    );
  }

  async findLatestRunByTaskId(taskId: string): Promise<AgentRun | null> {
    return this.db.get<AgentRun>(
      `SELECT
        id, task_id, request_id, run_no, model_name, status, output, error_code, error_message, started_at, finished_at
      FROM agent_runs
      WHERE task_id = ?
      ORDER BY run_no DESC
      LIMIT 1`,
      [taskId],
    );
  }

  async listRunsByRequestId(requestId: string): Promise<AgentRun[]> {
    return this.db.all<AgentRun>(
      `SELECT
        id, task_id, request_id, run_no, model_name, status, output, error_code, error_message, started_at, finished_at
      FROM agent_runs
      WHERE request_id = ?
      ORDER BY started_at ASC`,
      [requestId],
    );
  }

  async createRun(run: AgentRun): Promise<void> {
    const requestId = run.request_id ?? this.requestContext.getRequestId() ?? null;
    this.db.run(
      `INSERT INTO agent_runs (
        id, task_id, request_id, run_no, model_name, status, output, error_code, error_message, started_at, finished_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        run.id,
        run.task_id,
        requestId,
        run.run_no,
        run.model_name,
        run.status,
        run.output ?? null,
        run.error_code ?? null,
        run.error_message ?? null,
        run.started_at,
        run.finished_at ?? null,
      ],
    );
  }

  async saveRun(run: AgentRun): Promise<void> {
    this.db.run(
      `UPDATE agent_runs
      SET status = ?, output = ?, error_code = ?, error_message = ?, finished_at = ?
      WHERE id = ?`,
      [
        run.status,
        run.output ?? null,
        run.error_code ?? null,
        run.error_message ?? null,
        run.finished_at ?? null,
        run.id,
      ],
    );
  }

  async findModelRequestByAgentRunId(agentRunId: string): Promise<ModelRequest | null> {
    return this.db.get<ModelRequest>(
      `SELECT
        id, workspace_id, request_id, agent_run_id, provider, model_name, request_schema_version,
        prompt_artifact_ref, tool_spec_ref, status, started_at, finished_at
      FROM model_requests
      WHERE agent_run_id = ?`,
      [agentRunId],
    );
  }

  async listModelRequestsByWorkspaceId(workspaceId: string, limit: number): Promise<ModelRequest[]> {
    return this.db.all<ModelRequest>(
      `SELECT
        id, workspace_id, request_id, agent_run_id, provider, model_name, request_schema_version,
        prompt_artifact_ref, tool_spec_ref, status, started_at, finished_at
      FROM model_requests
      WHERE workspace_id = ?
      ORDER BY started_at DESC
      LIMIT ?`,
      [workspaceId, limit],
    );
  }

  async createModelRequest(modelRequest: ModelRequest): Promise<void> {
    const requestId = modelRequest.request_id ?? this.requestContext.getRequestId() ?? null;
    this.db.run(
      `INSERT INTO model_requests (
        id, workspace_id, request_id, agent_run_id, provider, model_name, request_schema_version,
        prompt_artifact_ref, tool_spec_ref, status, started_at, finished_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        modelRequest.id,
        modelRequest.workspace_id,
        requestId,
        modelRequest.agent_run_id ?? null,
        modelRequest.provider,
        modelRequest.model_name,
        modelRequest.request_schema_version,
        modelRequest.prompt_artifact_ref ?? null,
        modelRequest.tool_spec_ref ?? null,
        modelRequest.status,
        modelRequest.started_at,
        modelRequest.finished_at ?? null,
      ],
    );
  }

  async saveModelRequest(modelRequest: ModelRequest): Promise<void> {
    this.db.run(
      `UPDATE model_requests
      SET status = ?, finished_at = ?
      WHERE id = ?`,
      [modelRequest.status, modelRequest.finished_at ?? null, modelRequest.id],
    );
  }

  async listModelRequestAttempts(modelRequestId: string): Promise<ModelRequestAttempt[]> {
    return this.db.all<ModelRequestAttempt>(
      `SELECT
        id, model_request_id, attempt_no, provider_request_id, raw_response_ref,
        parsed_output, validation_error, error_code, error_message, started_at, finished_at
      FROM model_request_attempts
      WHERE model_request_id = ?
      ORDER BY attempt_no ASC`,
      [modelRequestId],
    );
  }

  async createModelRequestAttempt(attempt: ModelRequestAttempt): Promise<void> {
    this.db.run(
      `INSERT INTO model_request_attempts (
        id, model_request_id, attempt_no, provider_request_id, raw_response_ref,
        parsed_output, validation_error, error_code, error_message, started_at, finished_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        attempt.id,
        attempt.model_request_id,
        attempt.attempt_no,
        attempt.provider_request_id ?? null,
        attempt.raw_response_ref ?? null,
        attempt.parsed_output ?? null,
        attempt.validation_error ?? null,
        attempt.error_code ?? null,
        attempt.error_message ?? null,
        attempt.started_at,
        attempt.finished_at ?? null,
      ],
    );
  }

  async listToolCallsByAgentRunId(agentRunId: string): Promise<ToolCall[]> {
    return this.db.all<ToolCall>(
      `SELECT
        id, agent_run_id, request_id, tool_name, request_payload, response_payload, status, started_at, finished_at
      FROM tool_calls
      WHERE agent_run_id = ?
      ORDER BY started_at ASC`,
      [agentRunId],
    );
  }

  async createToolCall(toolCall: ToolCall): Promise<void> {
    const requestId = toolCall.request_id ?? this.requestContext.getRequestId() ?? null;
    this.db.run(
      `INSERT INTO tool_calls (
        id, agent_run_id, request_id, tool_name, request_payload, response_payload, status, started_at, finished_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        toolCall.id,
        toolCall.agent_run_id,
        requestId,
        toolCall.tool_name,
        toolCall.request_payload,
        toolCall.response_payload ?? null,
        toolCall.status,
        toolCall.started_at,
        toolCall.finished_at ?? null,
      ],
    );
  }
}
