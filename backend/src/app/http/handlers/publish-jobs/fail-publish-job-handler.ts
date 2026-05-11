import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { FailPublishJobRequest } from "../../../../contracts/api/account-credentials";
import type { MarkPublishFailed } from "../../../../modules/schedules/application/commands/mark-publish-failed";
import type { PublishJobResponse } from "../../../../contracts/api/schedules";

export async function failPublishJobHandler(
  command: MarkPublishFailed,
  publishJobId: string,
  input: FailPublishJobRequest,
): Promise<Result<PublishJobResponse>> {
  try {
    return ok(await command.execute(publishJobId, input.error_code, input.error_message));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
