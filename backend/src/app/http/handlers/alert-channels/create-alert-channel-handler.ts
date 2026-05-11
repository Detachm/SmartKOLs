import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { CreateAlertChannelRequest } from "../../../../contracts/api/alert-channels";
import type { CreateAlertChannel } from "../../../../modules/alert-channels/application/commands/create-alert-channel";
import type { AlertChannel } from "../../../../modules/alert-channels/domain/alert-channel";

export async function createAlertChannelHandler(
  command: CreateAlertChannel,
  input: CreateAlertChannelRequest,
): Promise<Result<AlertChannel>> {
  try {
    return ok(await command.execute(input));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
