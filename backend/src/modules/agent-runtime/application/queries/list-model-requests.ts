import type { AgentRuntimeRepository } from "../ports/agent-runtime-repository";

export interface ListModelRequestsDependencies {
  runtime: AgentRuntimeRepository;
}

export class ListModelRequests {
  constructor(private readonly deps: ListModelRequestsDependencies) {}

  async execute(workspaceId: string, limit: number) {
    return {
      items: await this.deps.runtime.listModelRequestsByWorkspaceId(workspaceId, limit),
    };
  }
}
