import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type {
  RequestDraftRegenerationRequest,
  RequestDraftRegenerationResponse,
} from "../../../../contracts/api/drafts";
import type { RequestDraftRegeneration } from "../../../../modules/drafts/application/commands/request-draft-regeneration";

export async function requestDraftRegenerationHandler(
  command: RequestDraftRegeneration,
  draftId: string,
  input: RequestDraftRegenerationRequest,
): Promise<Result<RequestDraftRegenerationResponse>> {
  try {
    return ok(await command.execute(draftId, input));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
