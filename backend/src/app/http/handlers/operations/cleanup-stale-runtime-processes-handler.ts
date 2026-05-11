import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type {
  CleanupStaleRuntimeProcessesRequest,
  CleanupStaleRuntimeProcessesResponse,
} from "../../../../contracts/api/operations";
import type { CleanupStaleRuntimeProcesses } from "../../../../modules/operations/application/commands/cleanup-stale-runtime-processes";

export async function cleanupStaleRuntimeProcessesHandler(
  command: CleanupStaleRuntimeProcesses,
  payload: CleanupStaleRuntimeProcessesRequest,
): Promise<Result<CleanupStaleRuntimeProcessesResponse>> {
  try {
    return ok(await command.execute(payload));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
