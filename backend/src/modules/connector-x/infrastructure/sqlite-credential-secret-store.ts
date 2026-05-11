import { AppError } from "../../../core/errors/app-error";
import { requireNonEmptyString } from "../../../core/validation/guards";
import type {
  ApiKeyCredentialSecret,
  CredentialSecretStore,
  OAuth1CredentialSecret,
  OAuth2CredentialSecret,
} from "../application/ports/credential-secret-store";
import type { ManagedSecretVault } from "../../secrets/application/ports/managed-secret-vault";

type JsonObject = Record<string, unknown>;

export class SqliteCredentialSecretStore implements CredentialSecretStore {
  constructor(
    private readonly vault: ManagedSecretVault,
    private readonly env: NodeJS.ProcessEnv = process.env,
  ) {}

  async readOAuth1Secret(secretRef: string): Promise<OAuth1CredentialSecret> {
    const value = await this.readCredentialJsonSecret(secretRef, ["x_oauth1"]);
    return {
      access_token: requireJsonString(value, "access_token"),
      access_token_secret: requireJsonString(value, "access_token_secret"),
    };
  }

  async readOAuth2Secret(secretRef: string): Promise<OAuth2CredentialSecret> {
    const value = await this.readCredentialJsonSecret(secretRef, ["x_oauth2"]);
    return {
      access_token: requireJsonString(value, "access_token"),
      refresh_token: requireJsonString(value, "refresh_token"),
      token_type: requireJsonString(value, "token_type"),
      expires_at: requireIsoDateString(value, "expires_at"),
      refreshed_at: requireIsoDateString(value, "refreshed_at"),
      scope: optionalJsonString(value, "scope"),
    };
  }

  async readApiKeySecret(secretRef: string): Promise<ApiKeyCredentialSecret> {
    const value = await this.readCredentialJsonSecret(secretRef, ["api_key"]);
    return {
      bearer_token: requireJsonString(value, "bearer_token"),
    };
  }

  async upsertOAuth1Secret(existingSecretRef: string | undefined, secret: OAuth1CredentialSecret): Promise<string> {
    const now = new Date().toISOString();
    return this.vault.upsertJsonSecret(existingSecretRef, {
      namespace: "connector_x",
      kind: "x_oauth1",
      secret,
      now,
    });
  }

  async upsertOAuth2Secret(existingSecretRef: string | undefined, secret: OAuth2CredentialSecret): Promise<string> {
    const now = requireIsoDateString({ now: secret.refreshed_at }, "now");
    return this.vault.upsertJsonSecret(existingSecretRef, {
      namespace: "connector_x",
      kind: "x_oauth2",
      secret,
      now,
    });
  }

  async upsertApiKeySecret(existingSecretRef: string | undefined, secret: ApiKeyCredentialSecret): Promise<string> {
    const now = new Date().toISOString();
    return this.vault.upsertJsonSecret(existingSecretRef, {
      namespace: "connector_x",
      kind: "api_key",
      secret,
      now,
    });
  }

  async deleteManagedSecret(secretRef: string | undefined): Promise<void> {
    await this.vault.deleteManagedSecret(secretRef, {
      namespace: "connector_x",
    });
  }

  private async readCredentialJsonSecret(secretRef: string, expectedKinds: readonly string[]): Promise<JsonObject> {
    if (secretRef.startsWith("managed:")) {
      return this.vault.readJsonSecret(secretRef, {
        namespace: "connector_x",
        expected_kinds: expectedKinds,
      }) as Promise<JsonObject>;
    }

    return this.readEnvJsonSecret(secretRef);
  }

  private readEnvJsonSecret(secretRef: string): JsonObject {
    const envName = this.parseEnvSecretRef(secretRef);
    const rawValue = this.env[envName];

    if (!rawValue || rawValue.trim() === "") {
      throw new AppError("INTERNAL_ERROR", "secret_ref target environment variable is not set", {
        details: {
          secret_ref: secretRef,
          env_name: envName,
        },
      });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawValue);
    } catch (error) {
      throw new AppError("INTERNAL_ERROR", "secret_ref environment variable must contain valid JSON", {
        cause: error,
        details: {
          secret_ref: secretRef,
          env_name: envName,
        },
      });
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new AppError("INTERNAL_ERROR", "secret_ref environment variable must contain a JSON object", {
        details: {
          secret_ref: secretRef,
          env_name: envName,
        },
      });
    }

    return parsed as JsonObject;
  }

  private parseEnvSecretRef(secretRef: string): string {
    const normalized = requireNonEmptyString(secretRef, "secret_ref");
    if (!normalized.startsWith("env:")) {
      throw new AppError("VALIDATION_ERROR", "secret_ref must use env:VAR_NAME format", {
        details: { secret_ref: normalized },
      });
    }

    return requireNonEmptyString(normalized.slice(4), "secret_ref env var");
  }
}

function requireJsonString(value: JsonObject, field: string): string {
  return requireNonEmptyString(value[field], field);
}

function optionalJsonString(value: JsonObject, field: string): string | undefined {
  const raw = value[field];
  if (typeof raw !== "string" || raw.trim() === "") {
    return undefined;
  }

  return raw.trim();
}

function requireIsoDateString(value: JsonObject, field: string): string {
  const text = requireJsonString(value, field);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)) {
    throw new AppError("INTERNAL_ERROR", `${field} must be a valid ISO datetime`, {
      details: {
        field,
        value: text,
      },
    });
  }

  return new Date(parsed).toISOString();
}
