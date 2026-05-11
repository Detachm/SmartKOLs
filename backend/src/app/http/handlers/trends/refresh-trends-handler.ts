import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { RefreshTrendsResponse } from "../../../../contracts/api/trends";
import type { RefreshTrends } from "../../../../modules/trends/application/commands/refresh-trends";

export async function refreshTrendsHandler(
  command: RefreshTrends,
  workspaceId: string,
): Promise<Result<RefreshTrendsResponse>> {
  try {
    return ok(await command.execute(workspaceId));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
