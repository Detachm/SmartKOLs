import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../../../core/errors/app-error";
import type {
  ApiKeyCredentialSecret,
  CredentialSecretStore,
  OAuth1CredentialSecret,
  OAuth2CredentialSecret,
} from "../application/ports/credential-secret-store";
import { XApiClient } from "./x-api-client";

class InMemorySecretStore implements CredentialSecretStore {
  constructor(private readonly oauth2: OAuth2CredentialSecret) {}

  async readOAuth1Secret(): Promise<OAuth1CredentialSecret> {
    throw new Error("not implemented");
  }

  async readOAuth2Secret(): Promise<OAuth2CredentialSecret> {
    return this.oauth2;
  }

  async readApiKeySecret(): Promise<ApiKeyCredentialSecret> {
    throw new Error("not implemented");
  }

  async upsertOAuth1Secret(): Promise<string> {
    throw new Error("not implemented");
  }

  async upsertOAuth2Secret(): Promise<string> {
    return "secret-ref";
  }

  async upsertApiKeySecret(): Promise<string> {
    throw new Error("not implemented");
  }

  async deleteManagedSecret(): Promise<void> {}
}

test("XApiClient preserves X error details when a successful response has no data envelope", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    errors: [
      {
        title: "Client Forbidden",
        detail: "User context OAuth scope is not authorized for this endpoint.",
      },
    ],
  }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

  const client = new XApiClient({
    oauth2_client_id: "client-id",
    oauth2_client_secret: "client-secret",
    base_url: "https://api.x.test",
    request_timeout_ms: 1000,
  }, new InMemorySecretStore({
    access_token: "access-token",
    refresh_token: "refresh-token",
    token_type: "bearer",
    expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    refreshed_at: new Date().toISOString(),
    scope: "tweet.read users.read",
  }));

  try {
    await assert.rejects(
      () => client.validateCredential({ provider: "x_oauth2", secret_ref: "secret-ref" }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, "EXTERNAL_DEPENDENCY_ERROR");
        assert.equal(error.message, "User context OAuth scope is not authorized for this endpoint.");
        assert.equal(error.details?.connector_error_code, "X_PERMISSION_DENIED");
        assert.equal(error.details?.endpoint, "/2/users/me");
        assert.equal(error.details?.status_code, 200);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
