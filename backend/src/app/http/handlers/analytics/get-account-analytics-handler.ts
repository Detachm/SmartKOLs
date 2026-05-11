import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { AccountAnalyticsResponse } from "../../../../contracts/api/analytics";
import type { GetAccountAnalytics } from "../../../../modules/analytics/application/queries/get-account-analytics";

export async function getAccountAnalyticsHandler(
  query: GetAccountAnalytics,
  accountId: string,
  windowDays?: number,
): Promise<Result<AccountAnalyticsResponse>> {
  try {
    return ok(await query.execute(accountId, windowDays));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
