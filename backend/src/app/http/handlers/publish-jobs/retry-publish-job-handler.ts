import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { PublishJobResponse } from "../../../../contracts/api/schedules";
import type { RetryPublishJob } from "../../../../modules/schedules/application/commands/retry-publish-job";

export async function retryPublishJobHandler(
  command: RetryPublishJob,
  publishJobId: string,
): Promise<Result<PublishJobResponse>> {
  try {
    return ok(await command.execute(publishJobId));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
