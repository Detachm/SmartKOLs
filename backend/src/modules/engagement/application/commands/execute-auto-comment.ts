import { AppError } from "../../../../core/errors/app-error";
import type { Clock } from "../../../../core/time/clock";
import type { AccountsRepository } from "../../../accounts/application/ports/accounts-repository";
import type { AccountCredentialsRepository } from "../../../connector-x/application/ports/account-credentials-repository";
import type { ConnectorRequestRepository } from "../../../connector-x/application/ports/connector-request-repository";
import type { TwitterClient, TwitterTimelinePost } from "../../../connector-x/application/ports/twitter-client";
import type { CommentOnPost } from "../../../connector-x/application/commands/comment-on-post";
import type { QueueAccountAutomationTick } from "../../../orchestration/application/commands/queue-account-automation-tick";
import type { EngagementPoliciesRepository } from "../ports/engagement-policies-repository";
import type { ModelGateway } from "../../../agent-runtime/application/ports/model-gateway";
import type { TrendsRepository } from "../../../trends/application/ports/trends-repository";
import { assertCredentialUsable } from "../../../connector-x/domain/account-credential";
import {
  addMinutes,
  countSucceededToday,
  extractSucceededPayloadStrings,
  normalizeHandle,
  pickDeterministicIndex,
  splitHandlesAndQueries,
} from "../automation-policy-helpers";
import { buildPublicSquareSearchQueries, rankCandidatePosts } from "../engagement-candidate-pool";

const AUTO_COMMENT_PUBLIC_SEARCH_QUERY_LIMIT = 2;
const AUTO_COMMENT_SEARCH_MAX_RESULTS = 10;

export interface ExecuteAutoCommentDependencies {
  accounts: AccountsRepository;
  policies: EngagementPoliciesRepository;
  credentials: AccountCredentialsRepository;
  connectorRequests: ConnectorRequestRepository;
  twitterClient: TwitterClient;
  commentOnPost: CommentOnPost;
  queueAccountAutomationTick: QueueAccountAutomationTick;
  modelGateway: ModelGateway;
  trends: TrendsRepository;
  clock: Clock;
}

export class ExecuteAutoComment {
  constructor(private readonly deps: ExecuteAutoCommentDependencies) {}

  async execute(accountId: string) {
    const account = await this.deps.accounts.findById(accountId);
    if (!account) {
      throw new AppError("NOT_FOUND", "account not found", { details: { account_id: accountId } });
    }

    const policy = await this.deps.policies.findByAccountId(accountId);
    const autoCommentPolicy = policy?.policy_body.auto_comment;
    if (!policy || policy.status !== "active" || !autoCommentPolicy?.enabled) {
      throw new AppError("INVALID_STATE", "auto comment policy is not active", { details: { account_id: accountId } });
    }

    const accountHandle = normalizeHandle(account.handle);
    const splitTargets = splitHandlesAndQueries(autoCommentPolicy.target_handles);
    const targetHandles = splitTargets.handles.filter((handle) => handle !== accountHandle);
    const searchQueries = splitTargets.queries;
    if (targetHandles.length === 0 && searchQueries.length === 0) {
      throw new AppError("VALIDATION_ERROR", "auto comment targets must include at least one external handle or search query", {
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
    if (countSucceededToday(requests, "post.comment", now) >= autoCommentPolicy.max_per_day) {
      const runAfter = addMinutes(now, 60);
      await this.deps.queueAccountAutomationTick.execute({
        account_id: account.id,
        trigger_kind: "system",
        create_if_missing: true,
        run_after: runAfter,
      });
      return { status: "daily_limit_reached" as const, run_after: runAfter };
    }

    const existingTargetPostIds = extractSucceededPayloadStrings(requests, "post.comment", "comment_on_external_post_id");
    const publicSquareQueries = buildPublicSquareSearchQueries({
      explicitQueries: searchQueries,
      activeTrends: await this.deps.trends.listByWorkspaceId(account.workspace_id),
      limit: AUTO_COMMENT_PUBLIC_SEARCH_QUERY_LIMIT,
      allowTrendExpansion: searchQueries.length > 0,
    });
    const timelines = await Promise.all(targetHandles.map(async (handle) => ({
      handle,
      posts: (await this.deps.twitterClient.listUserPosts({
        account_id: account.id,
        provider: credential.provider,
        secret_ref: credential.secret_ref,
        handle,
      })).posts,
    })));
    const searchResults = await Promise.all(publicSquareQueries.map(async (item) => ({
      query: item.query,
      source_type: item.source_type,
      posts: (await this.deps.twitterClient.searchRecentPosts({
        account_id: account.id,
        provider: credential.provider,
        secret_ref: credential.secret_ref,
        query: item.query,
        max_results: AUTO_COMMENT_SEARCH_MAX_RESULTS,
      })).posts,
    })));
    const candidates = rankCandidatePosts({
      timelineResults: timelines,
      searchResults,
      excludedPostIds: existingTargetPostIds,
      excludedHandle: accountHandle,
    });
    if (candidates.length === 0) {
      const runAfter = addMinutes(now, 30);
      await this.deps.queueAccountAutomationTick.execute({
        account_id: account.id,
        trigger_kind: "system",
        create_if_missing: true,
        run_after: runAfter,
      });
      return { status: "no_candidate" as const, run_after: runAfter };
    }

    const candidate = autoCommentPolicy.mode === "random"
      ? candidates[pickDeterministicIndex(`${account.id}:${now}`, candidates.length)]
      : candidates[0];
    const proposed = await this.deps.modelGateway.proposeReply({
      thread_id: `auto-comment:${account.id}:${candidate.external_post_id}`,
      channel: "comment",
      counterpart_handle: normalizeHandle(candidate.handle),
      preferred_style: autoCommentPolicy.style,
      messages: [{
        sender_handle: normalizeHandle(candidate.handle),
        content: candidate.content,
        created_at: candidate.occurred_at,
      }],
    }, { agent_version: "v1" });
    const result = await this.deps.commentOnPost.execute({
      account_id: account.id,
      comment_on_external_post_id: candidate.external_post_id,
      text: proposed.content,
      idempotency_key_override: `${account.id}:auto:comment:${candidate.external_post_id}`,
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
      target_post_id: candidate.external_post_id,
      text: proposed.content,
    };
  }
}
