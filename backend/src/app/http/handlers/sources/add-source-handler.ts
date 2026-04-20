import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { AddSourceRequest } from "../../../../contracts/api/sources";
import type { AddSource } from "../../../../modules/sources/application/commands/add-source";
import type { Source } from "../../../../modules/sources/domain/source";

export async function addSourceHandler(
  command: AddSource,
  accountId: string,
  input: AddSourceRequest,
): Promise<Result<Source>> {
  try {
    return ok(await command.execute({ account_id: accountId, ...input }));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
