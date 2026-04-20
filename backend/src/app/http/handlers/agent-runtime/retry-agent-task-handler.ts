import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { ClassifyInboxThreadResponse } from "../../../../contracts/api/agent-runtime";
import type { RetryAgentTask } from "../../../../modules/agent-runtime/application/commands/retry-agent-task";

export async function retryAgentTaskHandler(
  command: RetryAgentTask,
  taskId: string,
): Promise<Result<ClassifyInboxThreadResponse>> {
  try {
    return ok(await command.execute(taskId));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
