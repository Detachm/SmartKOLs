import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { FollowUser } from "../../../../modules/connector-x/application/commands/follow-user";

export async function followUserHandler(
  command: FollowUser,
  input: { account_id: string; target_handle: string },
): Promise<Result<{
  connector_request_id: string;
  target_user_id: string;
  target_handle?: string;
  following: boolean;
  pending_follow?: boolean;
}>> {
  try {
    return ok(await command.execute(input));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
