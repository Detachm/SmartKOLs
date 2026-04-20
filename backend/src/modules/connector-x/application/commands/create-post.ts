import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import { createConnectorIdempotencyKey } from "../../domain/idempotency-key";
import { createConnectorRequest } from "../../domain/connector-request";
import type { Clock } from "../../../../core/time/clock";
import type { AccountsRepository } from "../../../accounts/application/ports/accounts-repository";
import type { AccountCredentialsRepository } from "../ports/account-credentials-repository";
import type { ConnectorRequestRepository } from "../ports/connector-request-repository";
import type { RateLimitBucketsRepository } from "../ports/rate-limit-buckets-repository";
import type { TwitterClient } from "../ports/twitter-client";
import { assertCredentialUsable } from "../../domain/account-credential";
import type { ConnectorRequest } from "../../domain/connector-request";
import { syncRateLimitBucket } from "../rate-limit-sync";

export interface CreatePostDependencies {
  accounts: AccountsRepository;
  credentials: AccountCredentialsRepository;
  connectorRequests: ConnectorRequestRepository;
  rateLimitBuckets: RateLimitBucketsRepository;
  twitterClient: TwitterClient;
  clock: Clock;
}

export class CreatePost {
  constructor(private readonly deps: CreatePostDependencies) {}

  async execute(input: { account_id: string; text: string; idempotency_key_override?: string }) {
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
    const now = this.deps.clock.now().toISOString();
    const requestId = newId();
    const idempotencyKey = input.idempotency_key_override?.trim()
      || createConnectorIdempotencyKey([account.id, "post.create", input.text]);
    const runningLedger = await reserveConnectorRequest({
      repository: this.deps.connectorRequests,
      request: createConnectorRequest({
        id: requestId,
        workspace_id: account.workspace_id,
        account_id: account.id,
        credential_id: credential.id,
        endpoint_code: "post.create",
        idempotency_key: idempotencyKey,
        request_payload: JSON.stringify({ text: input.text }),
        status: "running",
        started_at: now,
      }),
    });
    const result = await this.createPostOnTwitter({
      account_id: account.id,
      provider: credential.provider,
      secret_ref: credential.secret_ref,
      text: input.text,
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
        endpoint_code: "post.create",
        rate_limit: result.rate_limit,
        updated_at: ledger.finished_at ?? now,
      });

      return {
        connector_request_id: ledger.id,
        external_post_id: result.external_post_id,
        external_post_url: result.external_post_url,
      };
    } catch (error) {
      throw new AppError("INTERNAL_ERROR", "post was created but local persistence failed", {
        cause: error,
        details: {
          account_id: account.id,
          connector_request_id: runningLedger.id,
          external_post_id: result.external_post_id,
        },
      });
    }
  }

  private async createPostOnTwitter(
    input: {
      account_id: string;
      provider: "x_oauth1" | "x_oauth2" | "api_key";
      secret_ref: string;
      text: string;
    },
    ledger: ConnectorRequest,
  ) {
    try {
      return await this.deps.twitterClient.createPost(input);
    } catch (error) {
      const appError = error instanceof AppError
        ? error
        : new AppError("EXTERNAL_DEPENDENCY_ERROR", "twitter createPost failed", { cause: error });

      try {
        await this.deps.connectorRequests.save(createConnectorRequest({
          ...ledger,
          status: "failed",
          error_code: appError.code,
          error_message: appError.message,
          finished_at: this.deps.clock.now().toISOString(),
        }));
      } catch (persistenceError) {
        throw new AppError("INTERNAL_ERROR", "twitter createPost failed and failure could not be recorded", {
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
