import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { UpdatePersona } from "../../../../modules/personas/application/commands/update-persona";
import type { UpdatePersonaInput, Persona } from "../../../../modules/personas/domain/persona";

export async function updatePersonaHandler(
  command: UpdatePersona,
  input: UpdatePersonaInput,
): Promise<Result<Persona>> {
  try {
    return ok(await command.execute(input));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
