import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { PublishScheduleResponse, UpdatePublishScheduleRequest } from "../../../../contracts/api/schedules";
import type { ReschedulePublishSchedule } from "../../../../modules/schedules/application/commands/reschedule-publish-schedule";

export async function reschedulePublishScheduleHandler(
  command: ReschedulePublishSchedule,
  scheduleId: string,
  input: UpdatePublishScheduleRequest,
): Promise<Result<PublishScheduleResponse>> {
  try {
    return ok(await command.execute(scheduleId, input));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
