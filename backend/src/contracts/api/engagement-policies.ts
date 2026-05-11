import type { EngagementPolicy } from "../../modules/engagement/domain/engagement-policy";

export interface UpsertEngagementPolicyRequest {
  policy_body: {
    allowed_channels: Array<"mention" | "reply" | "dm" | "comment">;
    blocked_classifications: Array<"collab" | "commerce" | "spam" | "normal" | "support">;
    require_manual_approval: boolean;
    auto_follow?: {
      enabled: boolean;
      max_per_day: number;
      rules: Array<{
        type: "keyword";
        value: string;
      }>;
    };
    auto_retweet?: {
      enabled: boolean;
      max_per_day: number;
      min_likes: number;
      whitelist: string[];
      keywords: string[];
      delay_min_minutes: number;
      delay_max_minutes: number;
      quote_tweet_enabled: boolean;
    };
    auto_comment?: {
      enabled: boolean;
      max_per_day: number;
      target_handles: string[];
      style: "supportive" | "questioning" | "value-add";
      mode: "latest" | "random";
    };
    auto_reply?: {
      enabled: boolean;
      max_per_day: number;
      trigger_types: Array<"mention" | "reply" | "dm" | "comment">;
      only_followers: boolean;
      style: "grateful" | "interactive" | "brief";
    };
  };
  status: "active" | "paused";
}

export interface EngagementPolicyResponse {
  policy: EngagementPolicy;
}
