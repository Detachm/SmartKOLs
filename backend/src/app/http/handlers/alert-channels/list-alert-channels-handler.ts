import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { AlertChannelListResponse } from "../../../../contracts/api/alert-channels";
import type { ListAlertChannels } from "../../../../modules/alert-channels/application/queries/list-alert-channels";

export async function listAlertChannelsHandler(
  query: ListAlertChannels,
  input: { workspace_id: string; limit?: number },
): Promise<Result<AlertChannelListResponse>> {
  try {
    return ok(await query.execute(input.workspace_id, input.limit));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
