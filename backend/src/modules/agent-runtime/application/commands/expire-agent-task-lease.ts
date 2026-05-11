import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { FailAutopostRun } from "../../../autopost/application/commands/fail-autopost-run";
import type { AutopostRunsRepository } from "../../../autopost/application/ports/autopost-runs-repository";
import type { AlertsRepository } from "../../../monitoring/application/ports/alerts-repository";
import { createAlert } from "../../../monitoring/domain/alert";
import type { AgentRuntimeRepository } from "../ports/agent-runtime-repository";
import { failAgentRun } from "../../domain/agent-run";
import { failAgentTask } from "../../domain/agent-task";
import { createModelRequestAttempt } from "../../domain/model-request-attempt";

export interface ExpireAgentTaskLeaseDependencies {
  runtime: AgentRuntimeRepository;
  autopostRuns: AutopostRunsRepository;
  failAutopostRun: FailAutopostRun;
  alerts: AlertsRepository;
  auditLogs: AuditLogRepository;
  clock: Clock;
}

export class ExpireAgentTaskLease {
  constructor(private readonly deps: ExpireAgentTaskLeaseDependencies) {}

  async execute(taskId: string) {
    const task = await this.deps.runtime.findTaskById(taskId);
    if (!task) {
      throw new AppError("NOT_FOUND", "agent task not found", {
        details: { task_id: taskId },
      });
    }

    if (task.status !== "running") {
      throw new AppError("INVALID_STATE", "agent task lease can only expire from running state", {
        details: { task_id: task.id, status: task.status },
      });
    }

    const finishedAt = this.deps.clock.now().toISOString();
    const nextTask = failAgentTask(task, finishedAt, "LEASE_EXPIRED", "agent task worker lease expired");
    const latestRun = await this.deps.runtime.findLatestRunByTaskId(task.id);
    if (latestRun && latestRun.status === "running") {
      await this.deps.runtime.saveRun(failAgentRun(latestRun, "LEASE_EXPIRED", "agent task worker lease expired", finishedAt));
      const modelRequest = await this.deps.runtime.findModelRequestByAgentRunId(latestRun.id);
      if (modelRequest && modelRequest.status === "running") {
        const attempts = await this.deps.runtime.listModelRequestAttempts(modelRequest.id);
        await this.deps.runtime.createModelRequestAttempt(createModelRequestAttempt({
          id: newId(),
          model_request_id: modelRequest.id,
          attempt_no: attempts.length + 1,
          error_code: "LEASE_EXPIRED",
          error_message: "agent task worker lease expired",
          started_at: finishedAt,
          finished_at: finishedAt,
        }));
        await this.deps.runtime.saveModelRequest({
          ...modelRequest,
          status: "failed",
          finished_at: finishedAt,
        });
      }
    }

    await this.deps.runtime.saveTask(nextTask);
    const autopostRun = await this.deps.autopostRuns.findActiveByTaskId(task.id);
    if (autopostRun) {
      await this.deps.failAutopostRun.execute(autopostRun.id, "LEASE_EXPIRED", "agent task worker lease expired");
    }
    await this.deps.auditLogs.append({
      id: newId(),
      workspace_id: task.workspace_id,
      actor_type: "system",
      entity_type: "agent_task",
      entity_id: task.id,
      action: "agent_task.lease_expired",
      before_state: JSON.stringify(task),
      after_state: JSON.stringify(nextTask),
      created_at: finishedAt,
    });
    await this.deps.alerts.create(createAlert({
      id: newId(),
      workspace_id: task.workspace_id,
      severity: "warning",
      source_type: "runtime",
      source_id: task.id,
      code: "agent.task.lease_expired",
      message: "agent task worker lease expired",
      payload: JSON.stringify({ task_id: task.id }),
      created_at: finishedAt,
    }));

    return nextTask;
  }
}
