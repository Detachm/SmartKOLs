import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { UpsertAccountCredentialRequest, AccountCredentialResponse } from "../../../../contracts/api/account-credentials";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import { createAccountCredential } from "../../domain/account-credential";
import type { AccountCredentialsRepository } from "../ports/account-credentials-repository";
import type { CredentialSecretStore } from "../ports/credential-secret-store";

export interface UpsertAccountCredentialDependencies {
  credentials: AccountCredentialsRepository;
  secretStore: CredentialSecretStore;
  auditLogs: AuditLogRepository;
  clock: Clock;
}

export class UpsertAccountCredential {
  constructor(private readonly deps: UpsertAccountCredentialDependencies) {}

  async execute(accountId: string, input: UpsertAccountCredentialRequest): Promise<AccountCredentialResponse> {
    const existing = await this.deps.credentials.findByAccountId(accountId);
    const now = this.deps.clock.now().toISOString();
    const workspaceId = await this.deps.credentials.getWorkspaceIdByAccountId(accountId);
    const secretRef = await this.resolveSecretRef(existing?.secret_ref, input, now);

    const credential = createAccountCredential({
      id: existing?.id ?? newId(),
      account_id: accountId,
      provider: input.provider,
      secret_ref: secretRef,
      status: input.status,
      last_validated_at: existing?.last_validated_at,
      created_at: existing?.created_at ?? now,
    });

    await this.deps.credentials.save(credential);
    await this.deps.auditLogs.append({
      id: newId(),
      workspace_id: workspaceId,
      actor_type: "system",
      entity_type: "account_credential",
      entity_id: credential.id,
      action: existing ? "account_credential.updated" : "account_credential.created",
      before_state: existing ? JSON.stringify(existing) : undefined,
      after_state: JSON.stringify(credential),
      created_at: now,
    });

    return credential;
  }

  private async resolveSecretRef(
    existingSecretRef: string | undefined,
    input: UpsertAccountCredentialRequest,
    now: string,
  ): Promise<string> {
    if (input.provider === "x_oauth1") {
      if ("oauth1_token" in input) {
        return this.deps.secretStore.upsertOAuth1Secret(existingSecretRef, {
          access_token: input.oauth1_token.access_token.trim(),
          access_token_secret: input.oauth1_token.access_token_secret.trim(),
        });
      }

      await this.deps.secretStore.deleteManagedSecret(existingSecretRef);
      return input.secret_ref;
    }

    if (input.provider === "api_key") {
      if ("api_key_token" in input) {
        return this.deps.secretStore.upsertApiKeySecret(existingSecretRef, {
          bearer_token: input.api_key_token.bearer_token.trim(),
        });
      }

      await this.deps.secretStore.deleteManagedSecret(existingSecretRef);
      return input.secret_ref;
    }

    return this.deps.secretStore.upsertOAuth2Secret(existingSecretRef, {
      access_token: input.oauth2_token.access_token.trim(),
      refresh_token: input.oauth2_token.refresh_token.trim(),
      token_type: input.oauth2_token.token_type.trim(),
      expires_at: new Date(Date.parse(now) + input.oauth2_token.expires_in * 1000).toISOString(),
      refreshed_at: now,
      scope: input.oauth2_token.scope?.trim() || undefined,
    });
  }
}
