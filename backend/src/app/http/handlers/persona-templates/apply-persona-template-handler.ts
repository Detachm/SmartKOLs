import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { ApplyPersonaTemplateRequest, ApplyPersonaTemplateResponse } from "../../../../contracts/api/persona-templates";
import type { ApplyPersonaTemplate } from "../../../../modules/personas/application/commands/apply-persona-template";

export async function applyPersonaTemplateHandler(
  command: ApplyPersonaTemplate,
  templateId: string,
  input: ApplyPersonaTemplateRequest,
): Promise<Result<ApplyPersonaTemplateResponse>> {
  try {
    return ok(await command.execute({
      template_id: templateId,
      account_ids: input.account_ids,
      actor_id: input.actor_id,
    }));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
