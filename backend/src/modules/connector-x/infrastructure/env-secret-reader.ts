import { AppError } from "../../../core/errors/app-error";
import { requireNonEmptyString } from "../../../core/validation/guards";

interface XOAuth1CredentialSecret {
  access_token: string;
  access_token_secret: string;
}

interface XOAuth2CredentialSecret {
  access_token: string;
}

interface XApiKeyCredentialSecret {
  bearer_token: string;
}

type JsonObject = Record<string, unknown>;

export class EnvSecretReader {
  readOAuth1Secret(secretRef: string): XOAuth1CredentialSecret {
    const value = this.readJsonSecret(secretRef);
    return {
      access_token: requireJsonString(value, "access_token"),
      access_token_secret: requireJsonString(value, "access_token_secret"),
    };
  }

  readOAuth2Secret(secretRef: string): XOAuth2CredentialSecret {
    const value = this.readJsonSecret(secretRef);
    return {
      access_token: requireJsonString(value, "access_token"),
    };
  }

  readApiKeySecret(secretRef: string): XApiKeyCredentialSecret {
    const value = this.readJsonSecret(secretRef);
    return {
      bearer_token: requireJsonString(value, "bearer_token"),
    };
  }

  private readJsonSecret(secretRef: string): JsonObject {
    const envName = this.parseEnvSecretRef(secretRef);
    const rawValue = process.env[envName];

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
