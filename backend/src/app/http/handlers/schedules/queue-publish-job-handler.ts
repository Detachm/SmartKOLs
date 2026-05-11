import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { QueuePublishJob } from "../../../../modules/schedules/application/commands/queue-publish-job";
import type { PublishJobResponse } from "../../../../contracts/api/schedules";

export async function queuePublishJobHandler(
  command: QueuePublishJob,
  scheduleId: string,
): Promise<Result<PublishJobResponse>> {
  try {
    return ok(await command.execute(scheduleId));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
