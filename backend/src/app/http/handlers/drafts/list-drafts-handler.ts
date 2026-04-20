import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { DraftListResponse } from "../../../../contracts/api/drafts";
import type { ListDrafts, ListDraftsInput } from "../../../../modules/drafts/application/queries/list-drafts";

export async function listDraftsHandler(
  query: ListDrafts,
  input?: ListDraftsInput,
): Promise<Result<DraftListResponse>> {
  try {
    return ok(await query.execute(input));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
