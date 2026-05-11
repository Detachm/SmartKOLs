import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { AppChromeOverviewResponse } from "../../../../contracts/api/app-chrome";
import type { GetAppChromeOverview } from "../../../../modules/app-chrome/application/queries/get-app-chrome-overview";

export async function getAppChromeOverviewHandler(
  query: GetAppChromeOverview,
  input: {
    workspace_id: string;
    notification_limit?: number;
    group_limit?: number;
  },
): Promise<Result<AppChromeOverviewResponse>> {
  try {
    return ok(await query.execute(input));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
