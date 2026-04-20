import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { WorkerJobResponse } from "../../../../contracts/api/worker-jobs";
import type { QueuePullMentionsJob } from "../../../../modules/execution/application/commands/queue-pull-mentions-job";

export async function pullMentionsHandler(
  command: QueuePullMentionsJob,
  accountId: string,
): Promise<Result<WorkerJobResponse>> {
  try {
    const job = await command.execute(accountId);
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
