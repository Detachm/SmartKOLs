import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { PublishScheduleResponse } from "../../../../contracts/api/schedules";
import type { CancelPublishSchedule } from "../../../../modules/schedules/application/commands/cancel-publish-schedule";

export async function cancelPublishScheduleHandler(
  command: CancelPublishSchedule,
  scheduleId: string,
): Promise<Result<PublishScheduleResponse>> {
  try {
    return ok(await command.execute(scheduleId));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
