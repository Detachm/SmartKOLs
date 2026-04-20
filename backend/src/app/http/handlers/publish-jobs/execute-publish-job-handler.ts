import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { ExecutePublishJob } from "../../../../modules/schedules/application/commands/execute-publish-job";
import type { PublishJobResponse } from "../../../../contracts/api/schedules";

export async function executePublishJobHandler(
  command: ExecutePublishJob,
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
