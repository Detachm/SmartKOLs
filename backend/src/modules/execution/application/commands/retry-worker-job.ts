import { AppError } from "../../../../core/errors/app-error";
import type { Clock } from "../../../../core/time/clock";
import type { WorkerJobsRepository } from "../ports/worker-jobs-repository";
import { retryWorkerJob } from "../../domain/worker-job";

export interface RetryWorkerJobDependencies {
  workerJobs: WorkerJobsRepository;
  clock: Clock;
}

export class RetryWorkerJob {
  constructor(private readonly deps: RetryWorkerJobDependencies) {}

  async execute(jobId: string) {
    const job = await this.deps.workerJobs.findById(jobId);
    if (!job) {
      throw new AppError("NOT_FOUND", "worker job not found", {
        details: { worker_job_id: jobId },
      });
    }

    const nextJob = retryWorkerJob(job, this.deps.clock.now().toISOString());
    await this.deps.workerJobs.save(nextJob);
    return nextJob;
  }
}
