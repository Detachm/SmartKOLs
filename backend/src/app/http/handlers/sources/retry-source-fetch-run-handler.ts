import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { FetchSourceResponse } from "../../../../contracts/api/source-fetch-runs";
import type { ExecuteSourceFetchRun } from "../../../../modules/sources/application/commands/execute-source-fetch-run";
import type { RetrySourceFetchRun } from "../../../../modules/sources/application/commands/retry-source-fetch-run";

export async function retrySourceFetchRunHandler(
  command: RetrySourceFetchRun,
  executeCommand: ExecuteSourceFetchRun,
  runId: string,
  options?: { execute_now?: boolean },
): Promise<Result<FetchSourceResponse>> {
  try {
    const retried = await command.execute(runId);
    if (options?.execute_now) {
      return ok(await executeCommand.execute(retried.run_id));
    }
    return ok(retried);
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
