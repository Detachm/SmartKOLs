import { AppError } from "../../../../core/errors/app-error";
import type { AgentRuntimeRepository } from "../ports/agent-runtime-repository";

export interface GetAgentTaskDependencies {
  runtime: AgentRuntimeRepository;
}

export class GetAgentTask {
  constructor(private readonly deps: GetAgentTaskDependencies) {}

  async execute(taskId: string) {
    const task = await this.deps.runtime.findTaskById(taskId);
    if (!task) {
      throw new AppError("NOT_FOUND", "agent task not found", {
        details: { task_id: taskId },
      });
    }

    const latestRun = await this.deps.runtime.findLatestRunByTaskId(task.id);

    return {
      task,
      latest_run: latestRun ?? undefined,
    };
  }
}
