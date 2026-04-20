import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { AccountsRepository } from "../../../accounts/application/ports/accounts-repository";
import type { EngagementRepository } from "../../../engagement/application/ports/engagement-repository";
import { createEngagementMessage } from "../../../engagement/domain/engagement-message";
import { createEngagementThread } from "../../../engagement/domain/engagement-thread";
import type { AccountCredentialsRepository } from "../ports/account-credentials-repository";
import type { ConnectorRequestRepository } from "../ports/connector-request-repository";
import type { RateLimitBucketsRepository } from "../ports/rate-limit-buckets-repository";
import type { TwitterClient } from "../ports/twitter-client";
import { assertCredentialUsable } from "../../domain/account-credential";
import { createConnectorRequest } from "../../domain/connector-request";
import { syncRateLimitBucket } from "../rate-limit-sync";

export interface PullDirectMessagesDependencies {
  accounts: AccountsRepository;
  credentials: AccountCredentialsRepository;
  engagement: EngagementRepository;
  connectorRequests: ConnectorRequestRepository;
  rateLimitBuckets: RateLimitBucketsRepository;
  twitterClient: TwitterClient;
  clock: Clock;
}

export class PullDirectMessages {
  constructor(private readonly deps: PullDirectMessagesDependencies) {}

  async execute(accountId: string) {
    const account = await this.deps.accounts.findById(accountId);
    if (!account) {
      throw new AppError("NOT_FOUND", "account not found", { details: { account_id: accountId } });
    }

    const credential = await this.deps.credentials.findValidByAccountId(accountId);
    if (!credential) {
      throw new AppError("NOT_FOUND", "valid account credential not found", { details: { account_id: accountId } });
    }

    assertCredentialUsable(credential);
    const startedAt = this.deps.clock.now().toISOString();
    const requestId = newId();
    const result = await this.pullDirectMessagesFromTwitter(accountId, credential.provider, credential.secret_ref, {
      account_id: accountId,
      workspace_id: account.workspace_id,
      credential_id: credential.id,
      request_id: requestId,
      started_at: startedAt,
    });

    try {
      let importedCount = 0;

      for (const item of result.messages) {
        const existingThread = await this.deps.engagement.findThreadByExternalId(accountId, item.external_thread_id);
        const thread = existingThread ?? createEngagementThread({
          id: newId(),
          workspace_id: account.workspace_id,
          account_id: accountId,
          channel: "dm",
          external_thread_id: item.external_thread_id,
          counterpart_handle: item.sender_handle,
          classification: "normal",
          status: "open",
          last_message_at: item.occurred_at,
          created_at: item.occurred_at,
        });
        const lastMessageAt = thread.last_message_at.localeCompare(item.occurred_at) >= 0
          ? thread.last_message_at
          : item.occurred_at;

        await this.deps.engagement.saveThread({
          ...thread,
          last_message_at: lastMessageAt,
          counterpart_handle: item.sender_handle,
        });
        const created = await this.deps.engagement.createMessage(createEngagementMessage({
          id: newId(),
          thread_id: thread.id,
          external_message_id: item.external_message_id,
          direction: "incoming",
          sender_handle: item.sender_handle,
          content: item.content,
          raw_payload: item.raw_payload,
          created_at: item.occurred_at,
        }));
        if (created) {
          importedCount += 1;
        }
      }

      await this.deps.connectorRequests.create(createConnectorRequest({
        id: requestId,
        workspace_id: account.workspace_id,
        account_id: accountId,
        credential_id: credential.id,
        endpoint_code: "dm.list",
        request_payload: JSON.stringify({}),
        response_payload: result.raw_response,
        platform_status_code: result.platform_status_code,
        status: "succeeded",
        started_at: startedAt,
        finished_at: this.deps.clock.now().toISOString(),
      }));
      await syncRateLimitBucket(this.deps.rateLimitBuckets, {
        credential_id: credential.id,
        account_id: accountId,
        endpoint_code: "dm.list",
        rate_limit: result.rate_limit,
        updated_at: this.deps.clock.now().toISOString(),
      });

      return { imported_count: importedCount };
    } catch (error) {
      throw new AppError("INTERNAL_ERROR", "direct messages were pulled but local persistence failed", {
        cause: error,
        details: {
          account_id: accountId,
          request_id: requestId,
        },
      });
    }
  }

  private async pullDirectMessagesFromTwitter(
    accountId: string,
    provider: "x_oauth1" | "x_oauth2" | "api_key",
    secretRef: string,
    ledger: {
      account_id: string;
      workspace_id: string;
      credential_id: string;
      request_id: string;
      started_at: string;
    },
  ) {
    try {
      return await this.deps.twitterClient.listDirectMessages({
        account_id: accountId,
        provider,
        secret_ref: secretRef,
      });
    } catch (error) {
      const appError = error instanceof AppError
        ? error
        : new AppError("EXTERNAL_DEPENDENCY_ERROR", "twitter listDirectMessages failed", { cause: error });

      try {
        await this.deps.connectorRequests.create(createConnectorRequest({
          id: ledger.request_id,
          workspace_id: ledger.workspace_id,
          account_id: ledger.account_id,
          credential_id: ledger.credential_id,
          endpoint_code: "dm.list",
          request_payload: JSON.stringify({}),
          status: "failed",
          error_code: appError.code,
          error_message: appError.message,
          started_at: ledger.started_at,
          finished_at: this.deps.clock.now().toISOString(),
        }));
      } catch (persistenceError) {
        throw new AppError("INTERNAL_ERROR", "twitter direct-messages pull failed and failure could not be recorded", {
          cause: persistenceError,
          details: {
            account_id: ledger.account_id,
            external_error_code: appError.code,
            external_error_message: appError.message,
          },
        });
      }

      throw appError;
    }
  }
}
