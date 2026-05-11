import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { AccountsRepository } from "../../../accounts/application/ports/accounts-repository";
import type { AccountCredentialsRepository } from "../ports/account-credentials-repository";
import type { ConnectorRequestRepository } from "../ports/connector-request-repository";
import type { RateLimitBucketsRepository } from "../ports/rate-limit-buckets-repository";
import type { TwitterClient } from "../ports/twitter-client";
import { assertCredentialUsable } from "../../domain/account-credential";
import { createConnectorIdempotencyKey } from "../../domain/idempotency-key";
import { createConnectorRequest, type ConnectorRequest } from "../../domain/connector-request";
import { syncRateLimitBucket } from "../rate-limit-sync";

export interface FollowUserDependencies {
  accounts: AccountsRepository;
  credentials: AccountCredentialsRepository;
  connectorRequests: ConnectorRequestRepository;
  rateLimitBuckets: RateLimitBucketsRepository;
  twitterClient: TwitterClient;
  clock: Clock;
}

export class FollowUser {
  constructor(private readonly deps: FollowUserDependencies) {}

  async execute(input: { account_id: string; target_handle: string; idempotency_key_override?: string }) {
    const account = await this.deps.accounts.findById(input.account_id);
    if (!account) {
      throw new AppError("NOT_FOUND", "account not found", {
        details: { account_id: input.account_id },
      });
    }

    const credential = await this.deps.credentials.findValidByAccountId(input.account_id);
    if (!credential) {
      throw new AppError("NOT_FOUND", "valid account credential not found", {
        details: { account_id: input.account_id },
      });
    }

    assertCredentialUsable(credential);
    const normalizedHandle = input.target_handle.trim();
    const now = this.deps.clock.now().toISOString();
    const requestId = newId();
    const baseIdempotencyKey = input.idempotency_key_override?.trim()
      || createConnectorIdempotencyKey([account.id, "user.follow", normalizedHandle]);
    const idempotencyKey = await resolveRetryableIdempotencyKey({
      repository: this.deps.connectorRequests,
      accountId: account.id,
      endpointCode: "user.follow",
      baseIdempotencyKey,
      retrySuffixSeed: now,
    });
    const runningLedger = await reserveConnectorRequest({
      repository: this.deps.connectorRequests,
      request: createConnectorRequest({
        id: requestId,
        workspace_id: account.workspace_id,
        account_id: account.id,
        credential_id: credential.id,
        endpoint_code: "user.follow",
        idempotency_key: idempotencyKey,
        request_payload: JSON.stringify({ target_handle: normalizedHandle }),
        status: "running",
        started_at: now,
      }),
    });
    const result = await this.followUserOnTwitter({
      account_id: account.id,
      provider: credential.provider,
      secret_ref: credential.secret_ref,
      target_handle: normalizedHandle,
    }, runningLedger);

    try {
      const ledger = createConnectorRequest({
        ...runningLedger,
        response_payload: result.raw_response,
        platform_status_code: result.platform_status_code,
        status: "succeeded",
        finished_at: this.deps.clock.now().toISOString(),
      });

      await this.deps.connectorRequests.save(ledger);
      await syncRateLimitBucket(this.deps.rateLimitBuckets, {
        credential_id: credential.id,
        account_id: account.id,
        endpoint_code: "user.follow",
        rate_limit: result.rate_limit,
        updated_at: ledger.finished_at ?? now,
      });

      return {
        connector_request_id: ledger.id,
        target_user_id: result.target_user_id,
        target_handle: result.target_handle,
        following: result.following,
        pending_follow: result.pending_follow,
      };
    } catch (error) {
      throw new AppError("INTERNAL_ERROR", "follow succeeded but local persistence failed", {
        cause: error,
        details: {
          account_id: account.id,
          connector_request_id: runningLedger.id,
          target_handle: normalizedHandle,
        },
      });
    }
  }

  private async followUserOnTwitter(
    input: {
      account_id: string;
      provider: "x_oauth1" | "x_oauth2" | "api_key";
      secret_ref: string;
      target_handle: string;
    },
    ledger: ConnectorRequest,
  ) {
    try {
      return await this.deps.twitterClient.followUser(input);
    } catch (error) {
      const appError = error instanceof AppError
        ? error
        : new AppError("EXTERNAL_DEPENDENCY_ERROR", "twitter followUser failed", { cause: error });

      try {
        await this.deps.connectorRequests.save(createConnectorRequest({
          ...ledger,
          status: "failed",
          error_code: appError.code,
          error_message: appError.message,
          finished_at: this.deps.clock.now().toISOString(),
        }));
      } catch (persistenceError) {
        throw new AppError("INTERNAL_ERROR", "twitter followUser failed and failure could not be recorded", {
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

async function reserveConnectorRequest(input: {
  repository: ConnectorRequestRepository;
  request: ConnectorRequest;
}) {
  const existing = await input.repository.findLatestByIdempotencyKey(
    input.request.account_id,
    input.request.endpoint_code,
    input.request.idempotency_key ?? "",
  );
  if (existing) {
    throw new AppError("CONFLICT", "connector idempotency key already exists", {
      details: {
        account_id: input.request.account_id,
        endpoint_code: input.request.endpoint_code,
        idempotency_key: input.request.idempotency_key,
        existing_connector_request_id: existing.id,
        existing_status: existing.status,
      },
    });
  }

  await input.repository.create(input.request);
  return input.request;
}

async function resolveRetryableIdempotencyKey(input: {
  repository: ConnectorRequestRepository;
  accountId: string;
  endpointCode: string;
  baseIdempotencyKey: string;
  retrySuffixSeed: string;
}) {
  const existing = await input.repository.findLatestByIdempotencyKey(
    input.accountId,
    input.endpointCode,
    input.baseIdempotencyKey,
  );

  if (!existing) {
    return input.baseIdempotencyKey;
  }

  if (existing.status === "failed" || existing.status === "rate_limited") {
    return `${input.baseIdempotencyKey}:retry:${input.retrySuffixSeed}`;
  }

  return input.baseIdempotencyKey;
}
