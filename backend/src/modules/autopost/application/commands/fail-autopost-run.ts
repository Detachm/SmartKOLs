import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { WorkerJobsRepository } from "../../../execution/application/ports/worker-jobs-repository";
import type { AlertsRepository } from "../../../monitoring/application/ports/alerts-repository";
import { createAlert } from "../../../monitoring/domain/alert";
import type { AutopostPoliciesRepository } from "../ports/autopost-policies-repository";
import type { AutopostRunsRepository } from "../ports/autopost-runs-repository";
import { createAutopostPolicy } from "../../domain/autopost-policy";
import { failAutopostRun } from "../../domain/autopost-run";
import { syncAutopostPolicyWorkerJob } from "../worker-job-sync";

export interface FailAutopostRunDependencies {
  policies: AutopostPoliciesRepository;
  runs: AutopostRunsRepository;
  workerJobs: WorkerJobsRepository;
  auditLogs: AuditLogRepository;
  alerts: AlertsRepository;
  clock: Clock;
}

export class FailAutopostRun {
  constructor(private readonly deps: FailAutopostRunDependencies) {}

  async execute(runId: string, errorCode: string, errorMessage: string) {
    const run = await this.deps.runs.findById(runId);
    if (!run) {
      throw new AppError("NOT_FOUND", "autopost run not found", {
        details: { autopost_run_id: runId },
      });
    }

    if (["awaiting_review", "scheduled", "publish_queued"].includes(run.status)) {
      return run;
    }

    if (run.status === "failed") {
      return run;
    }

    const policy = await this.deps.policies.findById(run.policy_id);
    if (!policy) {
      throw new AppError("NOT_FOUND", "autopost policy not found", {
        details: { autopost_policy_id: run.policy_id, autopost_run_id: run.id },
      });
    }

    const now = this.deps.clock.now().toISOString();
    const nextRun = failAutopostRun(run, {
      error_code: errorCode,
      error_message: errorMessage,
      updated_at: now,
    });
    const nextPolicy = createAutopostPolicy({
      ...policy,
      last_run_id: run.id,
      last_run_status: "failed",
      last_failed_at: now,
      last_error_code: errorCode,
      last_error_message: errorMessage,
      updated_at: now,
    });

    await this.deps.runs.save(nextRun);
    await this.deps.policies.save(nextPolicy);
    await syncAutopostPolicyWorkerJob(this.deps.workerJobs, this.deps.clock, nextPolicy);
    await this.deps.auditLogs.append({
      id: newId(),
      workspace_id: nextRun.workspace_id,
      actor_type: "system",
      entity_type: "autopost_run",
      entity_id: nextRun.id,
      action: "autopost_run.failed",
      before_state: JSON.stringify(run),
      after_state: JSON.stringify(nextRun),
      created_at: now,
    });
    await this.deps.alerts.create(createAlert({
      id: newId(),
      workspace_id: nextRun.workspace_id,
      severity: "warning",
      source_type: "runtime",
      source_id: nextRun.id,
      code: "autopost.run.failed",
      message: errorMessage,
      payload: JSON.stringify({
        autopost_run_id: nextRun.id,
        autopost_policy_id: nextPolicy.id,
        error_code: errorCode,
      }),
      created_at: now,
    }));

    return nextRun;
  }
}
