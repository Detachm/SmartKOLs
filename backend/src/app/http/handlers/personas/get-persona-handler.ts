import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { PersonaResponse } from "../../../../contracts/api/personas";
import type { GetPersona } from "../../../../modules/personas/application/queries/get-persona";

export async function getPersonaHandler(
  query: GetPersona,
  accountId: string,
): Promise<Result<PersonaResponse>> {
  try {
    return ok(await query.execute(accountId));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
