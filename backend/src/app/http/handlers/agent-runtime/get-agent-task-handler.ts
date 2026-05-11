import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { AgentTaskDetailResponse } from "../../../../contracts/api/agent-runtime";
import type { GetAgentTask } from "../../../../modules/agent-runtime/application/queries/get-agent-task";

export async function getAgentTaskHandler(
  query: GetAgentTask,
  taskId: string,
): Promise<Result<AgentTaskDetailResponse>> {
  try {
    return ok(await query.execute(taskId));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
