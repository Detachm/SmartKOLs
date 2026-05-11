import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { WorkerJobResponse } from "../../../../contracts/api/worker-jobs";
import type { QueueSendReplyProposalJob } from "../../../../modules/execution/application/commands/queue-send-reply-proposal-job";

export async function sendReplyProposalHandler(
  command: QueueSendReplyProposalJob,
  proposalId: string,
): Promise<Result<WorkerJobResponse>> {
  try {
    const job = await command.execute(proposalId);
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
