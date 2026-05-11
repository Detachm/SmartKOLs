import type { AutopostPolicy } from "../../domain/autopost-policy";

export interface AutopostPoliciesRepository {
  findById(policyId: string): Promise<AutopostPolicy | null>;
  findByAccountId(accountId: string): Promise<AutopostPolicy | null>;
  listActiveScheduled(): Promise<AutopostPolicy[]>;
  save(policy: AutopostPolicy): Promise<void>;
}
