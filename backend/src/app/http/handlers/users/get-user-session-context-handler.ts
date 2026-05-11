import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { SessionContextResponse } from "../../../../contracts/api/local-auth";
import type { GetUserSessionContext } from "../../../../modules/users/application/queries/get-user-session-context";

export async function getUserSessionContextHandler(
  query: GetUserSessionContext,
  userId: string,
): Promise<Result<SessionContextResponse>> {
  try {
    return ok(await query.execute(userId));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
