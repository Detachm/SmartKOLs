import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { PersonaTemplateListResponse } from "../../../../contracts/api/persona-templates";
import type { ListPersonaTemplates } from "../../../../modules/personas/application/queries/list-persona-templates";

export async function listPersonaTemplatesHandler(
  query: ListPersonaTemplates,
  input: { workspace_id: string },
): Promise<Result<PersonaTemplateListResponse>> {
  try {
    return ok(await query.execute(input));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
