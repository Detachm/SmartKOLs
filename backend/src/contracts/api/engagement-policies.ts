import type { EngagementPolicy } from "../../modules/engagement/domain/engagement-policy";

export interface UpsertEngagementPolicyRequest {
  policy_body: {
    allowed_channels: Array<"mention" | "reply" | "dm" | "comment">;
    blocked_classifications: Array<"collab" | "commerce" | "spam" | "normal" | "support">;
    require_manual_approval: boolean;
  };
  status: "active" | "paused";
}

export interface EngagementPolicyResponse {
  policy: EngagementPolicy;
}
