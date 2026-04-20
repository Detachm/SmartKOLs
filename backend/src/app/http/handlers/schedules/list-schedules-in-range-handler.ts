import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { ScheduleRangeResponse } from "../../../../contracts/api/schedules";
import type {
  ListSchedulesInRange,
  ListSchedulesInRangeInput,
} from "../../../../modules/schedules/application/queries/list-schedules-in-range";

export async function listSchedulesInRangeHandler(
  query: ListSchedulesInRange,
  input: ListSchedulesInRangeInput,
): Promise<Result<ScheduleRangeResponse>> {
  try {
    return ok(await query.execute(input));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
