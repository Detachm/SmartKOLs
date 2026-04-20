import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { DeleteAlertChannelResponse } from "../../../../contracts/api/alert-channels";
import type { DeleteAlertChannel } from "../../../../modules/alert-channels/application/commands/delete-alert-channel";

export async function deleteAlertChannelHandler(
  command: DeleteAlertChannel,
  channelId: string,
): Promise<Result<DeleteAlertChannelResponse>> {
  try {
    return ok(await command.execute(channelId));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
