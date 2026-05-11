import { requireIntegerInRange, requireNonEmptyString } from "../../../../core/validation/guards";
import type { AppChromeOverviewResponse } from "../../../../contracts/api/app-chrome";

export interface AppChromeOverviewReadModel {
  getOverview(input: {
    workspace_id: string;
    notification_limit: number;
    group_limit: number;
  }): Promise<AppChromeOverviewResponse>;
}

export interface GetAppChromeOverviewDependencies {
  readModel: AppChromeOverviewReadModel;
}

export class GetAppChromeOverview {
  constructor(private readonly deps: GetAppChromeOverviewDependencies) {}

  async execute(input: {
    workspace_id: string;
    notification_limit?: number;
    group_limit?: number;
  }): Promise<AppChromeOverviewResponse> {
    return this.deps.readModel.getOverview({
      workspace_id: requireNonEmptyString(input.workspace_id, "workspace_id"),
      notification_limit: requireIntegerInRange(input.notification_limit ?? 8, "notification_limit", 1, 20),
      group_limit: requireIntegerInRange(input.group_limit ?? 8, "group_limit", 1, 20),
    });
  }
}
