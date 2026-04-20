import { AppError } from "../../../../core/errors/app-error";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { ConnectorRequestRepository } from "../../../connector-x/application/ports/connector-request-repository";
import type { AlertsRepository } from "../../../monitoring/application/ports/alerts-repository";
import type { AgentRuntimeRepository } from "../ports/agent-runtime-repository";

export interface GetAgentRunTraceDependencies {
  runtime: AgentRuntimeRepository;
  alerts: AlertsRepository;
  auditLogs: AuditLogRepository;
  connectorRequests: ConnectorRequestRepository;
}

export class GetAgentRunTrace {
  constructor(private readonly deps: GetAgentRunTraceDependencies) {}

  async execute(runId: string) {
    const run = await this.deps.runtime.findRunById(runId);
    if (!run) {
      throw new AppError("NOT_FOUND", "agent run not found", {
        details: { run_id: runId },
      });
    }

    const task = await this.deps.runtime.findTaskById(run.task_id);
    if (!task) {
      throw new AppError("NOT_FOUND", "agent task not found", {
        details: { task_id: run.task_id },
      });
    }

    const modelRequest = await this.deps.runtime.findModelRequestByAgentRunId(run.id);
    const attempts = modelRequest
      ? await this.deps.runtime.listModelRequestAttempts(modelRequest.id)
      : [];
    const toolCalls = await this.deps.runtime.listToolCallsByAgentRunId(run.id);

    const requestId = run.request_id;
    const [alerts, auditLogs, connectorRequests, siblingRuns] = requestId
      ? await Promise.all([
        this.deps.alerts.listByRequestId(requestId),
        this.deps.auditLogs.listByRequestId(requestId),
        this.deps.connectorRequests.listByRequestId(requestId),
        this.deps.runtime.listRunsByRequestId(requestId),
      ])
      : [[], [], [], []];

    return {
      request_id: requestId,
      task,
      run,
      model_request: modelRequest ?? undefined,
      attempts,
      tool_calls: toolCalls,
      alerts,
      audit_logs: auditLogs,
      connector_requests: connectorRequests,
      sibling_runs: siblingRuns.filter((candidate) => candidate.id !== run.id),
    };
  }
}
