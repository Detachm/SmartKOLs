import { AppError } from "../../../../core/errors/app-error";
import type { AgentRuntimeRepository } from "../ports/agent-runtime-repository";
import { retryAgentTask } from "../../domain/agent-task";

export interface RetryAgentTaskDependencies {
  runtime: AgentRuntimeRepository;
}

export class RetryAgentTask {
  constructor(private readonly deps: RetryAgentTaskDependencies) {}

  async execute(taskId: string) {
    const task = await this.deps.runtime.findTaskById(taskId);
    if (!task) {
      throw new AppError("NOT_FOUND", "agent task not found", {
        details: { task_id: taskId },
      });
    }

    const nextTask = retryAgentTask(task);
    await this.deps.runtime.saveTask(nextTask);

    return {
      task_id: nextTask.id,
      status: nextTask.status,
    };
  }
}
