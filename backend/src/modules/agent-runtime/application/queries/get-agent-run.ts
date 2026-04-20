import { AppError } from "../../../../core/errors/app-error";
import type { AgentRuntimeRepository } from "../ports/agent-runtime-repository";

export interface GetAgentRunDependencies {
  runtime: AgentRuntimeRepository;
}

export class GetAgentRun {
  constructor(private readonly deps: GetAgentRunDependencies) {}

  async execute(runId: string) {
    const run = await this.deps.runtime.findRunById(runId);
    if (!run) {
      throw new AppError("NOT_FOUND", "agent run not found", {
        details: { run_id: runId },
      });
    }

    const modelRequest = await this.deps.runtime.findModelRequestByAgentRunId(run.id);
    const attempts = modelRequest
      ? await this.deps.runtime.listModelRequestAttempts(modelRequest.id)
      : [];
    const toolCalls = await this.deps.runtime.listToolCallsByAgentRunId(run.id);

    return {
      run,
      model_request: modelRequest ?? undefined,
      attempts,
      tool_calls: toolCalls,
    };
  }
}
