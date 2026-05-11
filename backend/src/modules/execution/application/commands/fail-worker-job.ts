import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { AlertsRepository } from "../../../monitoring/application/ports/alerts-repository";
import { createAlert } from "../../../monitoring/domain/alert";
import type { WorkerJobsRepository } from "../ports/worker-jobs-repository";
import { failWorkerJob } from "../../domain/worker-job";

export interface FailWorkerJobDependencies {
  workerJobs: WorkerJobsRepository;
  alerts: AlertsRepository;
  auditLogs: AuditLogRepository;
  clock: Clock;
}

export class FailWorkerJob {
  constructor(private readonly deps: FailWorkerJobDependencies) {}

  async execute(jobId: string, errorCode: string, errorMessage: string) {
    const job = await this.deps.workerJobs.findById(jobId);
    if (!job) {
      throw new AppError("NOT_FOUND", "worker job not found", {
        details: { worker_job_id: jobId },
      });
    }

    const finishedAt = this.deps.clock.now().toISOString();
    const nextJob = failWorkerJob(job, finishedAt, errorCode, errorMessage);
    await this.deps.workerJobs.save(nextJob);
    await this.deps.auditLogs.append({
      id: newId(),
      workspace_id: job.workspace_id,
      actor_type: "system",
      entity_type: "worker_job",
      entity_id: job.id,
      action: "worker_job.failed",
      before_state: JSON.stringify(job),
      after_state: JSON.stringify(nextJob),
      created_at: finishedAt,
    });
    await this.deps.alerts.create(createAlert({
      id: newId(),
      workspace_id: job.workspace_id,
      severity: "warning",
      source_type: "runtime",
      source_id: job.id,
      code: errorCode,
      message: errorMessage,
      payload: JSON.stringify({ worker_job_id: job.id, job_type: job.job_type, target_id: job.target_id }),
      created_at: finishedAt,
    }));
    return nextJob;
  }
}
