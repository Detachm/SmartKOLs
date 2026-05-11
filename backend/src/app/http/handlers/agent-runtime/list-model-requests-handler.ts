import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { ModelRequestsResponse } from "../../../../contracts/api/model-requests";
import type { ListModelRequests } from "../../../../modules/agent-runtime/application/queries/list-model-requests";

export async function listModelRequestsHandler(
  query: ListModelRequests,
  workspaceId: string,
  limit: number,
): Promise<Result<ModelRequestsResponse>> {
  try {
    return ok(await query.execute(workspaceId, limit));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
