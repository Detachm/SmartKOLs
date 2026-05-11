import { AppError } from "../../../../core/errors/app-error";
import type { EngagementPoliciesRepository } from "../ports/engagement-policies-repository";

export interface GetEngagementPolicyDependencies {
  policies: EngagementPoliciesRepository;
}

export class GetEngagementPolicy {
  constructor(private readonly deps: GetEngagementPolicyDependencies) {}

  async execute(accountId: string) {
    const policy = await this.deps.policies.findByAccountId(accountId);
    if (!policy) {
      throw new AppError("NOT_FOUND", "engagement policy not found", {
        details: { account_id: accountId },
      });
    }

    return { policy };
  }
}
