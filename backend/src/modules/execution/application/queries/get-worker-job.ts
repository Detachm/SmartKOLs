import { AppError } from "../../../../core/errors/app-error";
import type { WorkerJobsRepository } from "../ports/worker-jobs-repository";

export interface GetWorkerJobDependencies {
  workerJobs: WorkerJobsRepository;
}

export class GetWorkerJob {
  constructor(private readonly deps: GetWorkerJobDependencies) {}

  async execute(jobId: string) {
    const job = await this.deps.workerJobs.findById(jobId);
    if (!job) {
      throw new AppError("NOT_FOUND", "worker job not found", {
        details: { worker_job_id: jobId },
      });
    }

    return { job };
  }
}
