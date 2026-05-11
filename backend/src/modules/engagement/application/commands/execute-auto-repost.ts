import { AppError } from "../../../../core/errors/app-error";
import type { Clock } from "../../../../core/time/clock";
import type { AccountsRepository } from "../../../accounts/application/ports/accounts-repository";
import type { AccountCredentialsRepository } from "../../../connector-x/application/ports/account-credentials-repository";
import type { ConnectorRequestRepository } from "../../../connector-x/application/ports/connector-request-repository";
import type { TwitterClient, TwitterTimelinePost } from "../../../connector-x/application/ports/twitter-client";
import type { RepostPost } from "../../../connector-x/application/commands/repost-post";
import type { QueueAccountAutomationTick } from "../../../orchestration/application/commands/queue-account-automation-tick";
import type { EngagementPoliciesRepository } from "../ports/engagement-policies-repository";
import type { TrendsRepository } from "../../../trends/application/ports/trends-repository";
import { assertCredentialUsable } from "../../../connector-x/domain/account-credential";
import {
  addMilliseconds,
  addMinutes,
  countSucceededToday,
  deterministicDelayMs,
  extractSucceededPayloadStrings,
  normalizeHandle,
  splitHandlesAndQueries,
  uniqueNonEmptyStrings,
} from "../automation-policy-helpers";
import { buildPublicSquareSearchQueries, rankCandidatePosts } from "../engagement-candidate-pool";

const AUTO_REPOST_PUBLIC_SEARCH_QUERY_LIMIT = 2;
const AUTO_REPOST_SEARCH_MAX_RESULTS = 10;

export interface ExecuteAutoRepostDependencies {
  accounts: AccountsRepository;
  policies: EngagementPoliciesRepository;
  credentials: AccountCredentialsRepository;
  connectorRequests: ConnectorRequestRepository;
  twitterClient: TwitterClient;
  repostPost: RepostPost;
  queueAccountAutomationTick: QueueAccountAutomationTick;
  trends: TrendsRepository;
  clock: Clock;
}

export class ExecuteAutoRepost {
  constructor(private readonly deps: ExecuteAutoRepostDependencies) {}

  async execute(accountId: string) {
    const account = await this.deps.accounts.findById(accountId);
    if (!account) {
      throw new AppError("NOT_FOUND", "account not found", { details: { account_id: accountId } });
    }

    const policy = await this.deps.policies.findByAccountId(accountId);
    const autoRepostPolicy = policy?.policy_body.auto_retweet;
    if (!policy || policy.status !== "active" || !autoRepostPolicy?.enabled) {
      throw new AppError("INVALID_STATE", "auto repost policy is not active", { details: { account_id: accountId } });
    }

    const accountHandle = normalizeHandle(account.handle);
    const splitWhitelist = splitHandlesAndQueries(autoRepostPolicy.whitelist);
    const whitelist = splitWhitelist.handles.filter((handle) => handle !== accountHandle);
    const searchQueries = uniqueNonEmptyStrings([
      ...splitWhitelist.queries,
      ...(autoRepostPolicy.keywords ?? []),
    ]);
    if (whitelist.length === 0 && searchQueries.length === 0) {
      throw new AppError("VALIDATION_ERROR", "auto repost config must include at least one external handle or search keyword", {
        details: { account_id: accountId, account_handle: accountHandle },
      });
    }

    const credential = await this.deps.credentials.findValidByAccountId(accountId);
    if (!credential) {
      throw new AppError("NOT_FOUND", "valid account credential not found", { details: { account_id: accountId } });
    }

    assertCredentialUsable(credential);
    const now = this.deps.clock.now().toISOString();
    const requests = await this.deps.connectorRequests.listByWorkspaceId(account.workspace_id, 2000, account.id);
    if (countSucceededToday(requests, "post.repost", now) >= autoRepostPolicy.max_per_day) {
      const runAfter = addMinutes(now, 60);
      await this.deps.queueAccountAutomationTick.execute({
        account_id: account.id,
        trigger_kind: "system",
        create_if_missing: true,
        run_after: runAfter,
      });
      return { status: "daily_limit_reached" as const, run_after: runAfter };
    }

    const existingPostIds = extractSucceededPayloadStrings(requests, "post.repost", "target_post_id");
    const publicSquareQueries = buildPublicSquareSearchQueries({
      explicitQueries: searchQueries,
      activeTrends: await this.deps.trends.listByWorkspaceId(account.workspace_id),
      limit: AUTO_REPOST_PUBLIC_SEARCH_QUERY_LIMIT,
      allowTrendExpansion: searchQueries.length > 0,
    });
    const timelines = (await Promise.all(whitelist.map(async (handle) => {
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
    }))).filter((timeline) => timeline.posts.length > 0);
    const searchResults = await Promise.all(publicSquareQueries.map(async (item) => ({
      query: item.query,
      source_type: item.source_type,
      posts: (await this.deps.twitterClient.searchRecentPosts({
        account_id: account.id,
        provider: credential.provider,
        secret_ref: credential.secret_ref,
        query: item.query,
        max_results: AUTO_REPOST_SEARCH_MAX_RESULTS,
      })).posts,
    })));
    const candidate = rankCandidatePosts({
      timelineResults: timelines,
      searchResults,
      excludedPostIds: existingPostIds,
      excludedHandle: accountHandle,
      minLikeCount: autoRepostPolicy.min_likes,
    })[0];

    if (!candidate) {
      const runAfter = addMinutes(now, 30);
      await this.deps.queueAccountAutomationTick.execute({
        account_id: account.id,
        trigger_kind: "system",
        create_if_missing: true,
        run_after: runAfter,
      });
      return { status: "no_candidate" as const, run_after: runAfter };
    }

    const dueAt = addMilliseconds(
      candidate.occurred_at,
      deterministicDelayMs(
        `${account.id}:${candidate.external_post_id}`,
        autoRepostPolicy.delay_min_minutes,
        autoRepostPolicy.delay_max_minutes,
      ),
    );
    if (dueAt > now) {
      await this.deps.queueAccountAutomationTick.execute({
        account_id: account.id,
        trigger_kind: "system",
        create_if_missing: true,
        run_after: dueAt,
      });
      return {
        status: "scheduled" as const,
        run_after: dueAt,
        target_post_id: candidate.external_post_id,
      };
    }

    const result = await this.deps.repostPost.execute({
      account_id: account.id,
      target_post_id: candidate.external_post_id,
      idempotency_key_override: `${account.id}:auto:repost:${candidate.external_post_id}`,
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
      target_post_id: result.target_post_id,
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
