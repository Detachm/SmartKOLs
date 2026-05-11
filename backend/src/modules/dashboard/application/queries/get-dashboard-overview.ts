import { requireNonEmptyString } from "../../../../core/validation/guards";
import type { DashboardOverviewResponse } from "../../../../contracts/api/dashboard";

export interface DashboardOverviewReadModel {
  getDashboardOverview(workspaceId: string): Promise<DashboardOverviewResponse>;
}

export interface GetDashboardOverviewDependencies {
  readModel: DashboardOverviewReadModel;
}

export class GetDashboardOverview {
  constructor(private readonly deps: GetDashboardOverviewDependencies) {}

  async execute(workspaceId: string): Promise<DashboardOverviewResponse> {
    return this.deps.readModel.getDashboardOverview(requireNonEmptyString(workspaceId, "workspace_id"));
  }
}
