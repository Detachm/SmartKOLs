import { requireIntegerInRange, requireNonEmptyString } from "../../../../core/validation/guards";
import type { AppCommandSearchResponse } from "../../../../contracts/api/app-chrome";

export interface AppCommandSearchReadModel {
  search(input: {
    workspace_id: string;
    query: string;
    limit: number;
  }): Promise<AppCommandSearchResponse>;
}

export interface SearchAppCommandTargetsDependencies {
  readModel: AppCommandSearchReadModel;
}

export class SearchAppCommandTargets {
  constructor(private readonly deps: SearchAppCommandTargetsDependencies) {}

  async execute(input: {
    workspace_id: string;
    query?: string;
    limit?: number;
  }): Promise<AppCommandSearchResponse> {
    return this.deps.readModel.search({
      workspace_id: requireNonEmptyString(input.workspace_id, "workspace_id"),
      query: (input.query ?? "").trim(),
      limit: requireIntegerInRange(input.limit ?? 24, "limit", 1, 50),
    });
  }
}
