import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { IngestSourceDocumentsRequest, IngestSourceDocumentsResponse } from "../../../../contracts/api/sources";
import type { IngestSourceDocuments } from "../../../../modules/sources/application/commands/ingest-source-documents";

export async function ingestSourceDocumentsHandler(
  command: IngestSourceDocuments,
  sourceId: string,
  input: IngestSourceDocumentsRequest,
): Promise<Result<IngestSourceDocumentsResponse>> {
  try {
    return ok(await command.execute(sourceId, input.documents));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
