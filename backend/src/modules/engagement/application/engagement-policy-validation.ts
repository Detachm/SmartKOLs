import { AppError } from "../../../core/errors/app-error";
import type { EngagementPolicy, EngagementPolicyRule } from "../domain/engagement-policy";
import { normalizeHandle, splitHandlesAndQueries, uniqueNonEmptyStrings } from "./automation-policy-helpers";

export type EngagementAutomationFeature = "auto_follow" | "auto_retweet" | "auto_comment" | "auto_reply";

export interface EngagementAutomationValidationIssue {
  feature: EngagementAutomationFeature;
  message: string;
}

export interface EngagementAutomationValidationResult {
  enabled_features: EngagementAutomationFeature[];
  valid_features: EngagementAutomationFeature[];
  invalid_features: EngagementAutomationValidationIssue[];
}

export interface EngagementAutomationSanitizationResult {
  policy_body: EngagementPolicyRule;
  changed: boolean;
  disabled_features: EngagementAutomationFeature[];
}

export function validateEngagementAutomationTargets(
  policy: Pick<EngagementPolicy, "account_id" | "policy_body">,
  accountHandle: string,
) {
  const validation = evaluateEngagementAutomationTargets(policy.policy_body, accountHandle);
  const firstIssue = validation.invalid_features[0];
  if (!firstIssue) {
    return;
  }

  throw new AppError("VALIDATION_ERROR", firstIssue.message, {
    details: {
      account_id: policy.account_id,
      feature: firstIssue.feature,
      account_handle: normalizeHandle(accountHandle),
      enabled_features: validation.enabled_features,
      valid_features: validation.valid_features,
      invalid_features: validation.invalid_features,
    },
  });
}

export function evaluateEngagementAutomationTargets(
  policyBody: EngagementPolicyRule,
  accountHandle: string,
): EngagementAutomationValidationResult {
  const selfHandle = normalizeHandle(accountHandle);
  const invalid_features: EngagementAutomationValidationIssue[] = [];
  const enabled_features = listEnabledEngagementAutomationFeatures(policyBody);
  const valid_features = new Set<EngagementAutomationFeature>();

  const autoCommentPolicy = policyBody.auto_comment;
  if (autoCommentPolicy?.enabled) {
    const splitTargets = splitHandlesAndQueries(autoCommentPolicy.target_handles);
    const externalHandles = splitTargets.handles.filter((handle) => handle !== selfHandle);
    if (externalHandles.length === 0 && splitTargets.queries.length === 0) {
      invalid_features.push({
        feature: "auto_comment",
        message: "auto comment targets must include at least one external handle or search query",
      });
    } else {
      valid_features.add("auto_comment");
    }
  }

  const autoRepostPolicy = policyBody.auto_retweet;
  if (autoRepostPolicy?.enabled) {
    const splitWhitelist = splitHandlesAndQueries(autoRepostPolicy.whitelist);
    const externalHandles = splitWhitelist.handles.filter((handle) => handle !== selfHandle);
    const searchKeywords = uniqueNonEmptyStrings([
      ...splitWhitelist.queries,
      ...autoRepostPolicy.keywords,
    ]);
    if (externalHandles.length === 0 && searchKeywords.length === 0) {
      invalid_features.push({
        feature: "auto_retweet",
        message: "auto repost config must include at least one external handle or search keyword",
      });
    } else {
      valid_features.add("auto_retweet");
    }
  }

  const autoFollowPolicy = policyBody.auto_follow;
  if (autoFollowPolicy?.enabled) {
    const splitRules = splitHandlesAndQueries(autoFollowPolicy.rules.map((rule) => rule.value));
    const externalHandles = splitRules.handles.filter((handle) => handle !== selfHandle);
    if (externalHandles.length === 0 && splitRules.queries.length === 0) {
      invalid_features.push({
        feature: "auto_follow",
        message: "auto follow rules must include at least one external handle or keyword",
      });
    } else {
      valid_features.add("auto_follow");
    }
  }

  if (policyBody.auto_reply?.enabled) {
    valid_features.add("auto_reply");
  }

  return {
    enabled_features,
    valid_features: enabled_features.filter((feature) => valid_features.has(feature)),
    invalid_features,
  };
}

export function sanitizeLegacyEngagementAutomationTargets(
  policyBody: EngagementPolicyRule,
  accountHandle: string,
): EngagementAutomationSanitizationResult {
  const selfHandle = normalizeHandle(accountHandle).toLowerCase();
  const autoFollowRules = Array.isArray(policyBody.auto_follow?.rules) ? policyBody.auto_follow.rules : [];
  const autoRetweetWhitelist = Array.isArray(policyBody.auto_retweet?.whitelist) ? policyBody.auto_retweet.whitelist : [];
  const autoRetweetKeywords = Array.isArray(policyBody.auto_retweet?.keywords) ? policyBody.auto_retweet.keywords : [];
  const autoCommentTargets = Array.isArray(policyBody.auto_comment?.target_handles) ? policyBody.auto_comment.target_handles : [];
  const autoReplyTriggerTypes = Array.isArray(policyBody.auto_reply?.trigger_types) ? policyBody.auto_reply.trigger_types : [];
  let changed = false;
  const disabled_features: EngagementAutomationFeature[] = [];
  const next: EngagementPolicyRule = {
    ...policyBody,
    auto_follow: policyBody.auto_follow ? {
      ...policyBody.auto_follow,
      rules: autoFollowRules,
    } : undefined,
    auto_retweet: policyBody.auto_retweet ? {
      ...policyBody.auto_retweet,
      whitelist: [...autoRetweetWhitelist],
      keywords: [...autoRetweetKeywords],
    } : undefined,
    auto_comment: policyBody.auto_comment ? {
      ...policyBody.auto_comment,
      target_handles: [...autoCommentTargets],
    } : undefined,
    auto_reply: policyBody.auto_reply ? {
      ...policyBody.auto_reply,
      trigger_types: [...autoReplyTriggerTypes],
    } : undefined,
  };

  if (next.auto_comment) {
    const filteredTargets = next.auto_comment.target_handles.filter((item) =>
      !(item.trim().startsWith("@") && normalizeHandle(item).toLowerCase() === selfHandle),
    );
    if (filteredTargets.length !== next.auto_comment.target_handles.length) {
      changed = true;
      next.auto_comment.target_handles = filteredTargets;
    }
    const splitTargets = splitHandlesAndQueries(next.auto_comment.target_handles);
    if (next.auto_comment.enabled && splitTargets.handles.length === 0 && splitTargets.queries.length === 0) {
      changed = true;
      next.auto_comment.enabled = false;
      disabled_features.push("auto_comment");
    }
  }

  if (next.auto_retweet) {
    const filteredWhitelist = next.auto_retweet.whitelist.filter((item) =>
      !(item.trim().startsWith("@") && normalizeHandle(item).toLowerCase() === selfHandle),
    );
    if (filteredWhitelist.length !== next.auto_retweet.whitelist.length) {
      changed = true;
      next.auto_retweet.whitelist = filteredWhitelist;
    }
    const splitTargets = splitHandlesAndQueries(next.auto_retweet.whitelist);
    const keywords = uniqueNonEmptyStrings([
      ...splitTargets.queries,
      ...next.auto_retweet.keywords,
    ]);
    if (next.auto_retweet.enabled && splitTargets.handles.length === 0 && keywords.length === 0) {
      changed = true;
      next.auto_retweet.enabled = false;
      disabled_features.push("auto_retweet");
    }
  }

  if (next.auto_follow) {
    const filteredRules = next.auto_follow.rules.filter((rule) =>
      !(rule.value.trim().startsWith("@") && normalizeHandle(rule.value).toLowerCase() === selfHandle),
    );
    if (filteredRules.length !== next.auto_follow.rules.length) {
      changed = true;
      next.auto_follow.rules = filteredRules;
    }
    const splitRules = splitHandlesAndQueries(next.auto_follow.rules.map((rule) => rule.value));
    if (next.auto_follow.enabled && splitRules.handles.length === 0 && splitRules.queries.length === 0) {
      changed = true;
      next.auto_follow.enabled = false;
      disabled_features.push("auto_follow");
    }
  }

  return {
    policy_body: next,
    changed,
    disabled_features,
  };
}

export function listEnabledEngagementAutomationFeatures(policyBody: EngagementPolicyRule) {
  const features: EngagementAutomationFeature[] = [];
  if (policyBody.auto_follow?.enabled) {
    features.push("auto_follow");
  }
  if (policyBody.auto_retweet?.enabled) {
    features.push("auto_retweet");
  }
  if (policyBody.auto_comment?.enabled) {
    features.push("auto_comment");
  }
  if (policyBody.auto_reply?.enabled) {
    features.push("auto_reply");
  }

  return features;
}
