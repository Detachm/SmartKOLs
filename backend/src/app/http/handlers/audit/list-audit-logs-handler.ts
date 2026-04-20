import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { AuditLogsResponse } from "../../../../contracts/api/audit-logs";
import type { ListAuditLogs } from "../../../../modules/audit/application/queries/list-audit-logs";

export async function listAuditLogsHandler(
  query: ListAuditLogs,
  workspaceId: string,
  limit: number,
  entityType?: string,
  entityId?: string,
): Promise<Result<AuditLogsResponse>> {
  try {
    return ok(await query.execute(workspaceId, limit, entityType, entityId));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
