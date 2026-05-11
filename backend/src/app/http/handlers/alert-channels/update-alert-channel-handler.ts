import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { UpdateAlertChannelRequest } from "../../../../contracts/api/alert-channels";
import type { UpdateAlertChannel } from "../../../../modules/alert-channels/application/commands/update-alert-channel";
import type { AlertChannel } from "../../../../modules/alert-channels/domain/alert-channel";

export async function updateAlertChannelHandler(
  command: UpdateAlertChannel,
  channelId: string,
  input: UpdateAlertChannelRequest,
): Promise<Result<AlertChannel>> {
  try {
    return ok(await command.execute({ channel_id: channelId, ...input }));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
