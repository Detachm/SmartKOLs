import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { RetryMonitoringQueueBacklogRequest, RetryMonitoringQueueBacklogResponse } from "../../../../contracts/api/monitoring";
import type { RetryMonitoringQueueBacklog } from "../../../../modules/monitoring/application/commands/retry-monitoring-queue-backlog";

export async function retryMonitoringQueueBacklogHandler(
  command: RetryMonitoringQueueBacklog,
  payload: RetryMonitoringQueueBacklogRequest,
): Promise<Result<RetryMonitoringQueueBacklogResponse>> {
  try {
    return ok(await command.execute(payload));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
