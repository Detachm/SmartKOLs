import { requireIntegerInRange, requireNonEmptyString } from "../../../../core/validation/guards";
import type { AccountAnalyticsResponse } from "../../../../contracts/api/analytics";

export interface AccountAnalyticsReadModel {
  getAccountAnalytics(input: {
    account_id: string;
    window_days: number;
  }): Promise<AccountAnalyticsResponse>;
}

export interface GetAccountAnalyticsDependencies {
  readModel: AccountAnalyticsReadModel;
}

export class GetAccountAnalytics {
  constructor(private readonly deps: GetAccountAnalyticsDependencies) {}

  async execute(accountId: string, windowDays = 30): Promise<AccountAnalyticsResponse> {
    return this.deps.readModel.getAccountAnalytics({
      account_id: requireNonEmptyString(accountId, "account_id"),
      window_days: requireIntegerInRange(windowDays, "window_days", 7, 90),
    });
  }
}
