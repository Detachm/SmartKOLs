import type { TrendsRepository } from "../ports/trends-repository";

export interface ListTrendsDependencies {
  trends: TrendsRepository;
}

export class ListTrends {
  constructor(private readonly deps: ListTrendsDependencies) {}

  async execute(workspaceId: string) {
    return {
      trends: await this.deps.trends.listByWorkspaceId(workspaceId),
    };
  }
}
