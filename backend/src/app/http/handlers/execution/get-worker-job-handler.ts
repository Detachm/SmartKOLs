import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { WorkerJobDetailResponse } from "../../../../contracts/api/worker-jobs";
import type { GetWorkerJob } from "../../../../modules/execution/application/queries/get-worker-job";

export async function getWorkerJobHandler(
  query: GetWorkerJob,
  jobId: string,
): Promise<Result<WorkerJobDetailResponse>> {
  try {
    return ok(await query.execute(jobId));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
