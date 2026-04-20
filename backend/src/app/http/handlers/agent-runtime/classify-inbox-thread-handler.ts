import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { ClassifyInboxThread } from "../../../../modules/agent-runtime/application/commands/classify-inbox-thread";
import type { ClassifyInboxThreadResponse } from "../../../../contracts/api/agent-runtime";

export async function classifyInboxThreadHandler(
  command: ClassifyInboxThread,
  threadId: string,
): Promise<Result<ClassifyInboxThreadResponse>> {
  try {
    return ok(await command.execute(threadId));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
