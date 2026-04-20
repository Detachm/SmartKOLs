import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { WorkerJobResponse } from "../../../../contracts/api/worker-jobs";
import type { RetryWorkerJob } from "../../../../modules/execution/application/commands/retry-worker-job";

export async function retryWorkerJobHandler(
  command: RetryWorkerJob,
  jobId: string,
): Promise<Result<WorkerJobResponse>> {
  try {
    const job = await command.execute(jobId);
    return ok({
      job_id: job.id,
      status: job.status,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
