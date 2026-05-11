import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { OperationsHealthResponse } from "../../../../contracts/api/operations";
import type { GetOperationsHealth } from "../../../../modules/operations/application/queries/get-operations-health";

export async function getOperationsHealthHandler(
  query: GetOperationsHealth,
): Promise<Result<OperationsHealthResponse>> {
  try {
    return ok(await query.execute());
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
