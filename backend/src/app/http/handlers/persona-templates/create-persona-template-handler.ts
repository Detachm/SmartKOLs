import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { CreatePersonaTemplateRequest, PersonaTemplateResponse } from "../../../../contracts/api/persona-templates";
import type { CreatePersonaTemplate } from "../../../../modules/personas/application/commands/create-persona-template";

export async function createPersonaTemplateHandler(
  command: CreatePersonaTemplate,
  input: CreatePersonaTemplateRequest,
): Promise<Result<PersonaTemplateResponse>> {
  try {
    return ok(await command.execute(input));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
