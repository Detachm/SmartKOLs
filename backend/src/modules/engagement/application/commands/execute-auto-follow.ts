import { AppError } from "../../../../core/errors/app-error";
import type { Clock } from "../../../../core/time/clock";
import type { AccountsRepository } from "../../../accounts/application/ports/accounts-repository";
import type { AccountCredentialsRepository } from "../../../connector-x/application/ports/account-credentials-repository";
import type { ConnectorRequestRepository } from "../../../connector-x/application/ports/connector-request-repository";
import type { TwitterClient } from "../../../connector-x/application/ports/twitter-client";
import type { FollowUser } from "../../../connector-x/application/commands/follow-user";
import type { QueueAccountAutomationTick } from "../../../orchestration/application/commands/queue-account-automation-tick";
import type { EngagementPoliciesRepository } from "../ports/engagement-policies-repository";
import type { TrendsRepository } from "../../../trends/application/ports/trends-repository";
import { assertCredentialUsable } from "../../../connector-x/domain/account-credential";
import {
  addMinutes,
  countSucceededToday,
  extractSucceededPayloadStrings,
  normalizeHandle,
  normalizeHandleKey,
  splitHandlesAndQueries,
  uniqueNonEmptyStrings,
} from "../automation-policy-helpers";
import { buildPublicSquareSearchQueries, rankCandidatePosts } from "../engagement-candidate-pool";

const AUTO_FOLLOW_PUBLIC_SEARCH_QUERY_LIMIT = 2;
const AUTO_FOLLOW_SEARCH_MAX_RESULTS = 10;

export interface ExecuteAutoFollowDependencies {
  accounts: AccountsRepository;
  policies: EngagementPoliciesRepository;
  credentials: AccountCredentialsRepository;
  connectorRequests: ConnectorRequestRepository;
  twitterClient: TwitterClient;
  followUser: FollowUser;
  queueAccountAutomationTick: QueueAccountAutomationTick;
  trends: TrendsRepository;
  clock: Clock;
}

export class ExecuteAutoFollow {
  constructor(private readonly deps: ExecuteAutoFollowDependencies) {}

  async execute(accountId: string) {
    const account = await this.deps.accounts.findById(accountId);
    if (!account) {
      throw new AppError("NOT_FOUND", "account not found", { details: { account_id: accountId } });
    }

    const policy = await this.deps.policies.findByAccountId(accountId);
    const autoFollowPolicy = policy?.policy_body.auto_follow;
    if (!policy || policy.status !== "active" || !autoFollowPolicy?.enabled) {
      throw new AppError("INVALID_STATE", "auto follow policy is not active", { details: { account_id: accountId } });
    }

    const credential = await this.deps.credentials.findValidByAccountId(accountId);
    if (!credential) {
      throw new AppError("NOT_FOUND", "valid account credential not found", { details: { account_id: accountId } });
    }

    assertCredentialUsable(credential);
    const now = this.deps.clock.now().toISOString();
    const accountHandle = normalizeHandle(account.handle);
    const requests = await this.deps.connectorRequests.listByWorkspaceId(account.workspace_id, 2000, account.id);
    if (countSucceededToday(requests, "user.follow", now) >= autoFollowPolicy.max_per_day) {
      const runAfter = addMinutes(now, 60);
      await this.deps.queueAccountAutomationTick.execute({
        account_id: account.id,
        trigger_kind: "system",
        create_if_missing: true,
        run_after: runAfter,
      });
      return { status: "daily_limit_reached" as const, run_after: runAfter };
    }

    const splitRules = splitHandlesAndQueries(autoFollowPolicy.rules.map((rule) => rule.value));
    const explicitHandles = splitRules.handles.filter((handle) => handle !== accountHandle);
    const keywordRules = splitRules.queries;
    const combinedTimelineTargets = uniqueNonEmptyStrings([
      ...(policy.policy_body.auto_retweet?.whitelist ?? []),
      ...(policy.policy_body.auto_comment?.target_handles ?? []),
    ]);
    const timelineHandles = splitHandlesAndQueries(combinedTimelineTargets).handles
      .map((handle) => normalizeHandle(handle))
      .filter((handle) => handle !== accountHandle);
    const followedHandles = extractSucceededPayloadStrings(requests, "user.follow", "target_handle");
    const candidateHandles = new Set<string>();
    for (const handle of explicitHandles) {
      candidateHandles.add(normalizeHandle(handle));
    }

    const publicSquareQueries = buildPublicSquareSearchQueries({
      explicitQueries: keywordRules,
      activeTrends: await this.deps.trends.listByWorkspaceId(account.workspace_id),
      limit: AUTO_FOLLOW_PUBLIC_SEARCH_QUERY_LIMIT,
      allowTrendExpansion: keywordRules.length > 0,
    });
    const timelines = timelineHandles.length > 0
      ? (await Promise.all(timelineHandles.map(async (handle) => {
        try {
          return {
            handle,
            posts: (await this.deps.twitterClient.listUserPosts({
              account_id: account.id,
              provider: credential.provider,
              secret_ref: credential.secret_ref,
              handle,
            })).posts,
          };
        } catch (error) {
          if (isMissingXResourceError(error)) {
            return { handle, posts: [] };
          }

          throw error;
        }
      }))).filter((timeline) => timeline.posts.length > 0)
      : [];
    const searchResults = publicSquareQueries.length > 0
      ? await Promise.all(publicSquareQueries.map(async (item) => ({
        query: item.query,
        source_type: item.source_type,
        posts: (await this.deps.twitterClient.searchRecentPosts({
          account_id: account.id,
          provider: credential.provider,
          secret_ref: credential.secret_ref,
          query: item.query,
          max_results: AUTO_FOLLOW_SEARCH_MAX_RESULTS,
        })).posts,
      })))
      : [];
    const rankedPosts = rankCandidatePosts({
      timelineResults: timelines,
      searchResults,
      excludedHandle: accountHandle,
    });
    for (const post of rankedPosts) {
      candidateHandles.add(normalizeHandle(post.handle));
    }

    if (keywordRules.length > 0 && timelineHandles.length > 0) {
      const keywordRulesLower = keywordRules.map((value) => value.toLowerCase());
      for (const timeline of timelines) {
        const latestMatchingPost = timeline.posts.find((post) =>
          post.kind === "post"
          && normalizeHandle(post.handle) !== accountHandle
          && keywordRulesLower.some((keyword) => post.content.toLowerCase().includes(keyword)));
        if (latestMatchingPost) {
          candidateHandles.add(normalizeHandle(latestMatchingPost.handle));
        }
      }
    }

    const nextHandle = Array.from(candidateHandles).find((handle) => !followedHandles.has(normalizeHandleKey(handle)));
    if (!nextHandle) {
      const runAfter = addMinutes(now, 30);
      await this.deps.queueAccountAutomationTick.execute({
        account_id: account.id,
        trigger_kind: "system",
        create_if_missing: true,
        run_after: runAfter,
      });
      return { status: "no_candidate" as const, run_after: runAfter };
    }

    const result = await this.deps.followUser.execute({
      account_id: account.id,
      target_handle: nextHandle,
      idempotency_key_override: `${account.id}:auto:follow:${normalizeHandleKey(nextHandle)}`,
    });
    await this.deps.queueAccountAutomationTick.execute({
      account_id: account.id,
      trigger_kind: "system",
      create_if_missing: true,
      run_after: addMinutes(now, 5),
    });
    return {
      status: "executed" as const,
      connector_request_id: result.connector_request_id,
      target_handle: result.target_handle ?? nextHandle,
    };
  }
}

function isMissingXResourceError(error: unknown): boolean {
  if (!(error instanceof AppError)) {
    return false;
  }

  const connectorErrorCode = typeof error.details?.connector_error_code === "string"
    ? error.details.connector_error_code
    : "";
  const message = error.message.toLowerCase();
  return connectorErrorCode === "X_RESOURCE_NOT_FOUND"
    || message.includes("could not find")
    || message.includes("not found")
    || message.includes("does not exist");
}
