import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { CompletePublishJobRequest } from "../../../../contracts/api/account-credentials";
import type { CompletePublishJob } from "../../../../modules/schedules/application/commands/complete-publish-job";
import type { PublishJobResponse } from "../../../../contracts/api/schedules";

export async function completePublishJobHandler(
  command: CompletePublishJob,
  publishJobId: string,
  input: CompletePublishJobRequest,
): Promise<Result<PublishJobResponse>> {
  try {
    return ok(await command.execute(publishJobId, input));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
