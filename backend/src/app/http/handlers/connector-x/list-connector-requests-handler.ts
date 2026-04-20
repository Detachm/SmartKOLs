import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { ConnectorRequestsResponse } from "../../../../contracts/api/connector-requests";
import type { ListConnectorRequests } from "../../../../modules/connector-x/application/queries/list-connector-requests";

export async function listConnectorRequestsHandler(
  query: ListConnectorRequests,
  workspaceId: string,
  limit: number,
  accountId?: string,
): Promise<Result<ConnectorRequestsResponse>> {
  try {
    return ok(await query.execute(workspaceId, limit, accountId));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
