import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { RemoveSource } from "../../../../modules/sources/application/commands/remove-source";

export async function removeSourceHandler(
  command: RemoveSource,
  sourceId: string,
): Promise<Result<{ deleted: true }>> {
  try {
    await command.execute(sourceId);
    return ok({ deleted: true as const });
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
