import { requireNonEmptyString, requireOneOf } from "../../../core/validation/guards";
import type { EngagementChannel, EngagementClassification } from "./engagement-thread";

export type EngagementPolicyStatus = "active" | "paused";

export interface EngagementPolicyRule {
  allowed_channels: EngagementChannel[];
  blocked_classifications: EngagementClassification[];
  require_manual_approval: boolean;
}

export interface EngagementPolicy {
  id: string;
  workspace_id: string;
  account_id: string;
  policy_body: EngagementPolicyRule;
  status: EngagementPolicyStatus;
  updated_at: string;
}

export function createEngagementPolicy(policy: EngagementPolicy): EngagementPolicy {
  return {
    id: requireNonEmptyString(policy.id, "id"),
    workspace_id: requireNonEmptyString(policy.workspace_id, "workspace_id"),
    account_id: requireNonEmptyString(policy.account_id, "account_id"),
    policy_body: {
      allowed_channels: policy.policy_body.allowed_channels,
      blocked_classifications: policy.policy_body.blocked_classifications,
      require_manual_approval: Boolean(policy.policy_body.require_manual_approval),
    },
    status: requireOneOf(policy.status, "status", ["active", "paused"] as const),
    updated_at: requireNonEmptyString(policy.updated_at, "updated_at"),
  };
}
