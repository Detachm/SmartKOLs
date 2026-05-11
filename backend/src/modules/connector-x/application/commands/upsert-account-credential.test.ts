import test from "node:test";
import assert from "node:assert/strict";
import { UpsertAccountCredential } from "./upsert-account-credential";

test("UpsertAccountCredential stores raw x_oauth1 tokens in managed secret storage", async () => {
  const saved: Array<{ provider: string; secret_ref: string }> = [];
  const command = new UpsertAccountCredential({
    credentials: {
      findByAccountId: async () => null,
      getWorkspaceIdByAccountId: async () => "ws_1",
      save: async (credential: { provider: string; secret_ref: string }) => {
        saved.push(credential);
      },
    } as never,
    secretStore: {
      upsertOAuth1Secret: async (_existingSecretRef: string | undefined, secret: { access_token: string; access_token_secret: string }) => {
        assert.equal(secret.access_token, "token_1");
        assert.equal(secret.access_token_secret, "secret_1");
        return "managed:oauth1_secret_1";
      },
      upsertOAuth2Secret: async () => "managed:unexpected",
      upsertApiKeySecret: async () => "managed:unexpected",
      deleteManagedSecret: async () => undefined,
    } as never,
    auditLogs: {
      append: async () => undefined,
    } as never,
    clock: {
      now: () => new Date("2026-04-21T15:00:00.000Z"),
    },
  });

  const credential = await command.execute("acct_1", {
    provider: "x_oauth1",
    status: "valid",
    oauth1_token: {
      access_token: "token_1",
      access_token_secret: "secret_1",
    },
  });

  assert.equal(credential.secret_ref, "managed:oauth1_secret_1");
  assert.equal(saved[0]?.secret_ref, "managed:oauth1_secret_1");
});

test("UpsertAccountCredential keeps explicit secret_ref for legacy x_oauth1 credentials", async () => {
  let deletedSecretRef: string | undefined;
  const command = new UpsertAccountCredential({
    credentials: {
      findByAccountId: async () => ({
        id: "cred_1",
        account_id: "acct_1",
        provider: "x_oauth1",
        secret_ref: "managed:old_secret",
        status: "valid",
        created_at: "2026-04-20T15:00:00.000Z",
      }),
      getWorkspaceIdByAccountId: async () => "ws_1",
      save: async () => undefined,
    } as never,
    secretStore: {
      upsertOAuth1Secret: async () => "managed:unexpected",
      upsertOAuth2Secret: async () => "managed:unexpected",
      upsertApiKeySecret: async () => "managed:unexpected",
      deleteManagedSecret: async (secretRef: string | undefined) => {
        deletedSecretRef = secretRef;
      },
    } as never,
    auditLogs: {
      append: async () => undefined,
    } as never,
    clock: {
      now: () => new Date("2026-04-21T15:00:00.000Z"),
    },
  });

  const credential = await command.execute("acct_1", {
    provider: "x_oauth1",
    status: "valid",
    secret_ref: "env:X_ACCOUNT_SECRET",
  });

  assert.equal(credential.secret_ref, "env:X_ACCOUNT_SECRET");
  assert.equal(deletedSecretRef, "managed:old_secret");
});
