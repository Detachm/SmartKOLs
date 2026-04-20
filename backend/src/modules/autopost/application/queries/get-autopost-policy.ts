import { AppError } from "../../../../core/errors/app-error";
import type { AutopostPoliciesRepository } from "../ports/autopost-policies-repository";

export interface GetAutopostPolicyDependencies {
  policies: AutopostPoliciesRepository;
}

export class GetAutopostPolicy {
  constructor(private readonly deps: GetAutopostPolicyDependencies) {}

  async execute(accountId: string) {
    const policy = await this.deps.policies.findByAccountId(accountId);
    if (!policy) {
      throw new AppError("NOT_FOUND", "autopost policy not found", {
        details: { account_id: accountId },
      });
    }

    return { policy };
  }
}
