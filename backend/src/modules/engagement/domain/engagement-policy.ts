import { requireNonEmptyString, requireOneOf } from "../../../core/validation/guards";
import type { EngagementChannel, EngagementClassification } from "./engagement-thread";

export type EngagementPolicyStatus = "active" | "paused";
export type AutoCommentStyle = "supportive" | "questioning" | "value-add";
export type AutoCommentMode = "latest" | "random";
export type AutoReplyStyle = "grateful" | "interactive" | "brief";

export interface AutoFollowRule {
  type: "keyword";
  value: string;
}

export interface AutoFollowPolicy {
  enabled: boolean;
  max_per_day: number;
  rules: AutoFollowRule[];
}

export interface AutoRetweetPolicy {
  enabled: boolean;
  max_per_day: number;
  min_likes: number;
  whitelist: string[];
  keywords: string[];
  delay_min_minutes: number;
  delay_max_minutes: number;
  quote_tweet_enabled: boolean;
}

export interface AutoCommentPolicy {
  enabled: boolean;
  max_per_day: number;
  target_handles: string[];
  style: AutoCommentStyle;
  mode: AutoCommentMode;
}

export interface AutoReplyPolicy {
  enabled: boolean;
  max_per_day: number;
  trigger_types: EngagementChannel[];
  only_followers: boolean;
  style: AutoReplyStyle;
}

export interface EngagementPolicyRule {
  allowed_channels: EngagementChannel[];
  blocked_classifications: EngagementClassification[];
  require_manual_approval: boolean;
  auto_follow?: AutoFollowPolicy;
  auto_retweet?: AutoRetweetPolicy;
  auto_comment?: AutoCommentPolicy;
  auto_reply?: AutoReplyPolicy;
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
  const normalizedAutoReply = normalizeAutoReplyPolicy(policy.policy_body.auto_reply);

  return {
    id: requireNonEmptyString(policy.id, "id"),
    workspace_id: requireNonEmptyString(policy.workspace_id, "workspace_id"),
    account_id: requireNonEmptyString(policy.account_id, "account_id"),
    policy_body: {
      allowed_channels: normalizedAutoReply.trigger_types,
      blocked_classifications: policy.policy_body.blocked_classifications,
      require_manual_approval: Boolean(policy.policy_body.require_manual_approval),
      auto_follow: normalizeAutoFollowPolicy(policy.policy_body.auto_follow),
      auto_retweet: normalizeAutoRetweetPolicy(policy.policy_body.auto_retweet),
      auto_comment: normalizeAutoCommentPolicy(policy.policy_body.auto_comment),
      auto_reply: normalizedAutoReply,
    },
    status: requireOneOf(policy.status, "status", ["active", "paused"] as const),
    updated_at: requireNonEmptyString(policy.updated_at, "updated_at"),
  };
}

function normalizeAutoFollowPolicy(input: AutoFollowPolicy | undefined): AutoFollowPolicy {
  return {
    enabled: Boolean(input?.enabled),
    max_per_day: normalizeNonNegativeInteger(input?.max_per_day, 15),
    rules: Array.isArray(input?.rules)
      ? input.rules
        .map((rule) => ({
          type: "keyword" as const,
          value: requireNonEmptyString(rule?.value ?? "", "policy_body.auto_follow.rules[].value"),
        }))
      : [],
  };
}

function normalizeAutoRetweetPolicy(input: AutoRetweetPolicy | undefined): AutoRetweetPolicy {
  const delayMin = normalizeNonNegativeInteger(input?.delay_min_minutes, 30);
  const delayMax = Math.max(delayMin, normalizeNonNegativeInteger(input?.delay_max_minutes, 120));

  return {
    enabled: Boolean(input?.enabled),
    max_per_day: normalizeNonNegativeInteger(input?.max_per_day, 3),
    min_likes: normalizeNonNegativeInteger(input?.min_likes, 0),
    whitelist: normalizeStringArray(input?.whitelist),
    keywords: normalizeStringArray(input?.keywords),
    delay_min_minutes: delayMin,
    delay_max_minutes: delayMax,
    quote_tweet_enabled: Boolean(input?.quote_tweet_enabled),
  };
}

function normalizeAutoCommentPolicy(input: AutoCommentPolicy | undefined): AutoCommentPolicy {
  return {
    enabled: Boolean(input?.enabled),
    max_per_day: normalizeNonNegativeInteger(input?.max_per_day, 5),
    target_handles: normalizeStringArray(input?.target_handles),
    style: requireOneOf(input?.style ?? "supportive", "policy_body.auto_comment.style", [
      "supportive",
      "questioning",
      "value-add",
    ] as const),
    mode: requireOneOf(input?.mode ?? "latest", "policy_body.auto_comment.mode", [
      "latest",
      "random",
    ] as const),
  };
}

function normalizeAutoReplyPolicy(input: AutoReplyPolicy | undefined): AutoReplyPolicy {
  const triggerTypes = Array.isArray(input?.trigger_types) && input.trigger_types.length > 0
    ? input.trigger_types.map((item) => requireOneOf(item, "policy_body.auto_reply.trigger_types[]", [
      "mention",
      "reply",
      "dm",
      "comment",
    ] as const))
    : ["mention", "reply"];

  return {
    enabled: Boolean(input?.enabled),
    max_per_day: normalizeNonNegativeInteger(input?.max_per_day, 30),
    trigger_types: Array.from(new Set(triggerTypes)) as EngagementChannel[],
    only_followers: Boolean(input?.only_followers),
    style: requireOneOf(input?.style ?? "grateful", "policy_body.auto_reply.style", [
      "grateful",
      "interactive",
      "brief",
    ] as const),
  };
}

function normalizeStringArray(input: string[] | undefined): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return Array.from(new Set(
    input
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => item !== ""),
  ));
}

function normalizeNonNegativeInteger(input: number | undefined, fallback: number): number {
  if (!Number.isInteger(input) || (input ?? 0) < 0) {
    return fallback;
  }

  return typeof input === "number" ? input : fallback;
}
