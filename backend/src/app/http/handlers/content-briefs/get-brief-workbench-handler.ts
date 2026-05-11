import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { BriefWorkbenchResponse } from "../../../../contracts/api/account-workbenches";
import type { GetBriefWorkbench, GetBriefWorkbenchInput } from "../../../../modules/content-briefs/application/queries/get-brief-workbench";

export async function getBriefWorkbenchHandler(
  query: GetBriefWorkbench,
  input: GetBriefWorkbenchInput,
): Promise<Result<BriefWorkbenchResponse>> {
  try {
    return ok(await query.execute(input));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
