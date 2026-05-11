import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { ScheduleDraft } from "../../../../modules/schedules/application/commands/schedule-draft";
import type { PublishScheduleResponse, ScheduleDraftRequest } from "../../../../contracts/api/schedules";

export async function scheduleDraftHandler(
  command: ScheduleDraft,
  draftId: string,
  input: ScheduleDraftRequest,
): Promise<Result<PublishScheduleResponse>> {
  try {
    return ok(await command.execute(draftId, input));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
