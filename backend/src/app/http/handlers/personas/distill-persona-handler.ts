import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { DistillPersonaRequest, DistillPersonaResponse } from "../../../../contracts/api/personas";
import type { DistillPersona } from "../../../../modules/personas/application/commands/distill-persona";

export async function distillPersonaHandler(
  command: DistillPersona,
  accountId: string,
  input: DistillPersonaRequest,
): Promise<Result<DistillPersonaResponse>> {
  try {
    return ok(await command.execute({
      account_id: accountId,
      samples: input.samples,
      twitter_handle: input.twitter_handle,
      source_ids: input.source_ids,
      max_samples: input.max_samples,
    }));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
