import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { AppCommandSearchResponse } from "../../../../contracts/api/app-chrome";
import type { SearchAppCommandTargets } from "../../../../modules/app-chrome/application/queries/search-app-command-targets";

export async function searchAppCommandTargetsHandler(
  query: SearchAppCommandTargets,
  input: {
    workspace_id: string;
    query?: string;
    limit?: number;
  },
): Promise<Result<AppCommandSearchResponse>> {
  try {
    return ok(await query.execute(input));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
