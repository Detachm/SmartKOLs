import test from "node:test";
import assert from "node:assert/strict";
import { AppError } from "../../../../core/errors/app-error";
import { CreatePost } from "./create-post";

test("CreatePost rejects over-limit content before touching persistence or the X client", async () => {
  let accountLookupCount = 0;

  const command = new CreatePost({
    accounts: {
      findById: async () => {
        accountLookupCount += 1;
        return null;
      },
    } as never,
    credentials: {
      findValidByAccountId: async () => {
        throw new Error("credential lookup should not run for invalid content");
      },
    } as never,
    connectorRequests: {
      findLatestByIdempotencyKey: async () => {
        throw new Error("connector request reservation should not run for invalid content");
      },
      create: async () => {
        throw new Error("connector request creation should not run for invalid content");
      },
      save: async () => {
        throw new Error("connector request save should not run for invalid content");
      },
    } as never,
    rateLimitBuckets: {
      save: async () => {
        throw new Error("rate limit sync should not run for invalid content");
      },
    } as never,
    twitterClient: {
      createPost: async () => {
        throw new Error("twitter client should not run for invalid content");
      },
    } as never,
    clock: {
      now: () => new Date("2026-04-22T09:30:00.000Z"),
    },
  });

  await assert.rejects(
    async () => command.execute({ account_id: "acct_1", text: "A".repeat(281) }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.code, "VALIDATION_ERROR");
      assert.match(error.message, /cannot be published/);
      assert.equal(error.details?.weighted_length, 281);
      assert.equal(error.details?.max_weighted_length, 280);
      return true;
    },
  );

  assert.equal(accountLookupCount, 0);
});

test("CreatePost reports the previous connector failure when a publish idempotency key is reused", async () => {
  const command = new CreatePost({
    accounts: {
      findById: async () => ({
        id: "acct_1",
        workspace_id: "ws_1",
        handle: "@nick",
        display_name: "nick",
        status: "active",
        created_at: "2026-04-26T07:00:00.000Z",
        updated_at: "2026-04-26T07:00:00.000Z",
      }),
    } as never,
    credentials: {
      findValidByAccountId: async () => ({
        id: "cred_1",
        account_id: "acct_1",
        provider: "x_oauth1",
        status: "valid",
        secret_ref: "secret_1",
        created_at: "2026-04-26T07:00:00.000Z",
        updated_at: "2026-04-26T07:00:00.000Z",
      }),
    } as never,
    connectorRequests: {
      findLatestByIdempotencyKey: async () => ({
        id: "connector_1",
        workspace_id: "ws_1",
        account_id: "acct_1",
        credential_id: "cred_1",
        endpoint_code: "post.create",
        idempotency_key: "publish:key:1",
        request_payload: "{}",
        status: "failed",
        error_code: "EXTERNAL_DEPENDENCY_ERROR",
        error_message: "Your enrolled account [2043967467991515136] does not have any credits to fulfill this request.",
        started_at: "2026-04-26T07:00:00.000Z",
        finished_at: "2026-04-26T07:00:01.000Z",
      }),
      create: async () => {
        throw new Error("connector request should not be created for a reused idempotency key");
      },
    } as never,
    rateLimitBuckets: {} as never,
    twitterClient: {
      createPost: async () => {
        throw new Error("twitter client should not run when idempotency reservation fails");
      },
    } as never,
    clock: {
      now: () => new Date("2026-04-26T07:15:00.000Z"),
    },
  });

  await assert.rejects(
    async () => command.execute({ account_id: "acct_1", text: "hello", idempotency_key_override: "publish:key:1" }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.code, "CONFLICT");
      assert.match(error.message, /previous request failed with EXTERNAL_DEPENDENCY_ERROR/);
      assert.match(error.message, /does not have any credits/);
      assert.equal(error.details?.existing_connector_request_id, "connector_1");
      assert.equal(error.details?.existing_status, "failed");
      assert.equal(error.details?.existing_error_code, "EXTERNAL_DEPENDENCY_ERROR");
      return true;
    },
  );
});
