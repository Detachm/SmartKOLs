import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { BootstrapLocalAuthRequest, SessionContextResponse } from "../../../../contracts/api/local-auth";
import type { BootstrapLocalSession } from "../../../../modules/users/application/commands/bootstrap-local-session";
import type { GetUserSessionContext } from "../../../../modules/users/application/queries/get-user-session-context";

export async function bootstrapLocalSessionHandler(
  command: BootstrapLocalSession,
  query: GetUserSessionContext,
  input: BootstrapLocalAuthRequest,
): Promise<Result<SessionContextResponse>> {
  try {
    const result = await command.execute(input);
    return ok(await query.execute(result.user.id));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
