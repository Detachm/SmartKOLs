import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { FetchSourceResponse } from "../../../../contracts/api/source-fetch-runs";
import type { FetchSource } from "../../../../modules/sources/application/commands/fetch-source";

export async function fetchSourceHandler(
  command: FetchSource,
  sourceId: string,
): Promise<Result<FetchSourceResponse>> {
  try {
    return ok(await command.execute(sourceId));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
