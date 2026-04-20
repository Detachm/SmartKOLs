import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { SourceDocumentListResponse } from "../../../../contracts/api/sources";
import type { ListSourceDocuments } from "../../../../modules/sources/application/queries/list-source-documents";

export async function listSourceDocumentsHandler(
  query: ListSourceDocuments,
  sourceId: string,
): Promise<Result<SourceDocumentListResponse>> {
  try {
    return ok(await query.execute(sourceId));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
