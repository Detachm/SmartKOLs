import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { ExecuteSourceFetchRunResponse } from "../../../../contracts/api/source-fetch-runs";
import type { ExecuteSourceFetchRun } from "../../../../modules/sources/application/commands/execute-source-fetch-run";

export async function executeSourceFetchRunHandler(
  command: ExecuteSourceFetchRun,
  runId: string,
): Promise<Result<ExecuteSourceFetchRunResponse>> {
  try {
    return ok(await command.execute(runId));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
