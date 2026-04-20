import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { ResumeSource } from "../../../../modules/sources/application/commands/resume-source";
import type { Source } from "../../../../modules/sources/domain/source";

export async function resumeSourceHandler(
  command: ResumeSource,
  sourceId: string,
): Promise<Result<Source>> {
  try {
    return ok(await command.execute(sourceId));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
