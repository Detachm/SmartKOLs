import { AppError } from "../../../core/errors/app-error";
import { requireNonEmptyString, requireOneOf } from "../../../core/validation/guards";

export type CredentialProvider = "x_oauth1" | "x_oauth2" | "api_key";
export type CredentialStatus = "valid" | "invalid" | "expired" | "revoked";

export interface AccountCredential {
  id: string;
  account_id: string;
  provider: CredentialProvider;
  secret_ref: string;
  status: CredentialStatus;
  last_validated_at?: string;
  created_at: string;
}

export function assertCredentialUsable(credential: AccountCredential): void {
  if (credential.status !== "valid") {
    throw new AppError("INVALID_STATE", `credential is not usable while status is ${credential.status}`, {
      details: { credential_id: credential.id, status: credential.status },
    });
  }
}

export function createAccountCredential(input: AccountCredential): AccountCredential {
  return {
    id: requireNonEmptyString(input.id, "id"),
    account_id: requireNonEmptyString(input.account_id, "account_id"),
    provider: requireOneOf(input.provider, "provider", ["x_oauth1", "x_oauth2", "api_key"] as const),
    secret_ref: requireNonEmptyString(input.secret_ref, "secret_ref"),
    status: requireOneOf(input.status, "status", ["valid", "invalid", "expired", "revoked"] as const),
    last_validated_at: input.last_validated_at?.trim() || undefined,
    created_at: requireNonEmptyString(input.created_at, "created_at"),
  };
}
