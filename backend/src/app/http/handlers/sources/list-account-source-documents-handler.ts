import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { AccountSourceDocumentListResponse } from "../../../../contracts/api/sources";
import type {
  ListAccountSourceDocuments,
  ListAccountSourceDocumentsInput,
} from "../../../../modules/sources/application/queries/list-account-source-documents";

export async function listAccountSourceDocumentsHandler(
  query: ListAccountSourceDocuments,
  input: ListAccountSourceDocumentsInput,
): Promise<Result<AccountSourceDocumentListResponse>> {
  try {
    return ok(await query.execute(input));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
