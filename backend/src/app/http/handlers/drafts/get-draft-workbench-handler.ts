import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { DraftWorkbenchResponse } from "../../../../contracts/api/account-workbenches";
import type { GetDraftWorkbench, GetDraftWorkbenchInput } from "../../../../modules/drafts/application/queries/get-draft-workbench";

export async function getDraftWorkbenchHandler(
  query: GetDraftWorkbench,
  input: GetDraftWorkbenchInput,
): Promise<Result<DraftWorkbenchResponse>> {
  try {
    return ok(await query.execute(input));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
