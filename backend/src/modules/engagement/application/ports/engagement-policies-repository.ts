import type { EngagementPolicy } from "../../domain/engagement-policy";

export interface EngagementPoliciesRepository {
  findByAccountId(accountId: string): Promise<EngagementPolicy | null>;
  save(policy: EngagementPolicy): Promise<void>;
}
