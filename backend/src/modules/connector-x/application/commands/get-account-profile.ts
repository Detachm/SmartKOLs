import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { AccountsRepository } from "../../../accounts/application/ports/accounts-repository";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { ComputeAccountHealthScore } from "../../../health/application/commands/compute-account-health-score";
import type { AlertsRepository } from "../../../monitoring/application/ports/alerts-repository";
import { createAlert } from "../../../monitoring/domain/alert";
import type { NotificationsRepository } from "../../../notifications/application/ports/notifications-repository";
import { createNotification } from "../../../notifications/domain/notification";
import type { AccountCredentialsRepository } from "../ports/account-credentials-repository";
import type { ConnectorRequestRepository } from "../ports/connector-request-repository";
import type { RateLimitBucketsRepository } from "../ports/rate-limit-buckets-repository";
import type { TwitterClient } from "../ports/twitter-client";
import { assertCredentialUsable } from "../../domain/account-credential";
import { createConnectorRequest } from "../../domain/connector-request";
import { syncRateLimitBucket } from "../rate-limit-sync";

export interface GetAccountProfileDependencies {
  accounts: AccountsRepository;
  credentials: AccountCredentialsRepository;
  connectorRequests: ConnectorRequestRepository;
  rateLimitBuckets: RateLimitBucketsRepository;
  alerts: AlertsRepository;
  notifications: NotificationsRepository;
  auditLogs: AuditLogRepository;
  computeHealthScore: ComputeAccountHealthScore;
  twitterClient: TwitterClient;
  clock: Clock;
}

export class GetAccountProfile {
  constructor(private readonly deps: GetAccountProfileDependencies) {}

  async execute(accountId: string) {
    const account = await this.deps.accounts.findById(accountId);
    if (!account) {
      throw new AppError("NOT_FOUND", "account not found", {
        details: { account_id: accountId },
      });
    }

    const credential = await this.deps.credentials.findValidByAccountId(accountId);
    if (!credential) {
      throw new AppError("NOT_FOUND", "valid account credential not found", {
        details: { account_id: accountId },
      });
    }

    assertCredentialUsable(credential);
    const startedAt = this.deps.clock.now().toISOString();
    const requestId = newId();
    const profile = await this.getProfileFromTwitter({
      account_id: account.id,
      provider: credential.provider,
      secret_ref: credential.secret_ref,
    }, {
      request_id: requestId,
      workspace_id: account.workspace_id,
      account_id: account.id,
      credential_id: credential.id,
      started_at: startedAt,
    });

    try {
      const nextAccount = {
        ...account,
        handle: profile.handle.startsWith("@") ? profile.handle : `@${profile.handle}`,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        follower_count: profile.follower_count,
        following_count: profile.following_count,
        post_count: profile.post_count,
        external_account_id: profile.external_account_id ?? account.external_account_id,
        updated_at: this.deps.clock.now().toISOString(),
      };
      await this.deps.accounts.save(nextAccount);

      const ledger = createConnectorRequest({
        id: requestId,
        workspace_id: account.workspace_id,
        account_id: account.id,
        credential_id: credential.id,
        endpoint_code: "account.profile.get",
        request_payload: JSON.stringify({}),
        response_payload: profile.raw_response,
        platform_status_code: profile.platform_status_code,
        status: "succeeded",
        started_at: startedAt,
        finished_at: this.deps.clock.now().toISOString(),
      });
      await this.deps.connectorRequests.create(ledger);
      await syncRateLimitBucket(this.deps.rateLimitBuckets, {
        credential_id: credential.id,
        account_id: account.id,
        endpoint_code: "account.profile.get",
        rate_limit: profile.rate_limit,
        updated_at: ledger.finished_at ?? startedAt,
      });

      const healthResult = await this.deps.computeHealthScore.execute(nextAccount.id);

      await this.deps.auditLogs.append({
        id: newId(),
        workspace_id: nextAccount.workspace_id,
        actor_type: "system",
        entity_type: "account",
        entity_id: nextAccount.id,
        action: "account.profile_synced",
        before_state: JSON.stringify(account),
        after_state: JSON.stringify(nextAccount),
        created_at: this.deps.clock.now().toISOString(),
      });

      return {
        account: nextAccount,
        health_score: healthResult.health_score,
      };
    } catch (error) {
      throw new AppError("INTERNAL_ERROR", "account profile was fetched but local persistence failed", {
        cause: error,
        details: {
          account_id: account.id,
          connector_request_id: requestId,
          external_account_id: profile.external_account_id,
        },
      });
    }
  }

  private async getProfileFromTwitter(
    input: {
      account_id: string;
      provider: "x_oauth1" | "x_oauth2" | "api_key";
      secret_ref: string;
    },
    ledger: {
      request_id: string;
      workspace_id: string;
      account_id: string;
      credential_id: string;
      started_at: string;
    },
  ) {
    try {
      return await this.deps.twitterClient.getAccountProfile(input);
    } catch (error) {
      const appError = error instanceof AppError
        ? error
        : new AppError("EXTERNAL_DEPENDENCY_ERROR", "twitter getAccountProfile failed", { cause: error });

      try {
        await this.deps.connectorRequests.create(createConnectorRequest({
          id: ledger.request_id,
          workspace_id: ledger.workspace_id,
          account_id: ledger.account_id,
          credential_id: ledger.credential_id,
          endpoint_code: "account.profile.get",
          request_payload: JSON.stringify({}),
          status: "failed",
          error_code: appError.code,
          error_message: appError.message,
          started_at: ledger.started_at,
          finished_at: this.deps.clock.now().toISOString(),
        }));
        await this.deps.alerts.create(createAlert({
          id: newId(),
          workspace_id: ledger.workspace_id,
          severity: "warning",
          source_type: "connector",
          source_id: ledger.account_id,
          code: "account.profile.sync_failed",
          message: appError.message,
          payload: JSON.stringify({ account_id: ledger.account_id, error_code: appError.code }),
          created_at: this.deps.clock.now().toISOString(),
        }));
        await this.deps.notifications.create(createNotification({
          id: newId(),
          workspace_id: ledger.workspace_id,
          type: "action",
          title: "Account profile sync failed",
          body: `Account profile sync failed: ${appError.message}`,
          link: `/accounts/${ledger.account_id}`,
          created_at: this.deps.clock.now().toISOString(),
        }));
      } catch (persistenceError) {
        throw new AppError("INTERNAL_ERROR", "twitter getAccountProfile failed and failure could not be recorded", {
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
