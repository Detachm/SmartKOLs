import { AppError } from "../../../core/errors/app-error";
import type {
  TwitterAccountProfile,
  TwitterCreatedPost,
  TwitterDirectMessageResult,
  TwitterInboxPullResult,
  TwitterRateLimitSnapshot,
  TwitterReplyResult,
  TwitterTimelinePullResult,
} from "../application/ports/twitter-client";
import type {
  CredentialSecretStore,
  OAuth2CredentialSecret,
} from "../application/ports/credential-secret-store";
import { normalizeConnectorError } from "../domain/error-normalizer";
import { createOAuth1AuthorizationHeader } from "./x-api-oauth1";

export interface XApiConfig {
  api_key?: string;
  api_secret?: string;
  oauth2_client_id: string;
  oauth2_client_secret: string;
  base_url: string;
  request_timeout_ms: number;
}

interface XApiEnvelope<TData> {
  data?: TData;
  includes?: Record<string, unknown>;
  errors?: Array<Record<string, unknown>>;
}

interface XApiUserPublicMetrics {
  followers_count: number;
  following_count: number;
  tweet_count: number;
}

interface XApiAuthenticatedUser {
  id: string;
  username: string;
  name: string;
  profile_image_url?: string;
  public_metrics?: XApiUserPublicMetrics;
}

interface XApiTweet {
  id: string;
  text: string;
  author_id?: string;
  conversation_id?: string;
  created_at?: string;
}

interface XApiDmEvent {
  id: string;
  event_type: string;
  text?: string;
  sender_id?: string;
  created_at?: string;
  dm_conversation_id?: string;
}

interface XApiIncludedUser {
  id: string;
  username: string;
}

interface XApiRequestResult<TData> {
  data: TData;
  raw_response: string;
  platform_status_code: string;
  rate_limit?: TwitterRateLimitSnapshot;
  includes?: Record<string, unknown>;
}

type UserContextAuthorization =
  | {
      type: "oauth1";
      access_token: string;
      access_token_secret: string;
    }
  | {
      type: "bearer";
      access_token: string;
    };

interface ResolvedAuthorization {
  authorization: UserContextAuthorization;
  oauth2?: {
    secret_ref: string;
    secret: OAuth2CredentialSecret;
  };
}

export class XApiClient {
  private readonly baseUrl: string;
  private readonly requestTimeoutMs: number;

  constructor(
    private readonly config: XApiConfig,
    private readonly secretStore: CredentialSecretStore,
  ) {
    this.baseUrl = config.base_url.trim();
    this.requestTimeoutMs = config.request_timeout_ms;
  }

  async validateCredential(input: {
    provider: "x_oauth1" | "x_oauth2" | "api_key";
    secret_ref: string;
  }): Promise<{ provider_account_id: string; validated_at: string }> {
    const user = await this.getAuthenticatedUser(input);
    return {
      provider_account_id: user.id,
      validated_at: new Date().toISOString(),
    };
  }

  async getAccountProfile(input: {
    provider: "x_oauth1" | "x_oauth2" | "api_key";
    secret_ref: string;
  }): Promise<TwitterAccountProfile> {
    const response = await this.fetchAuthenticatedUser(input);
    const user = response.data;
    const metrics = requireUserPublicMetrics(user.public_metrics);

    return {
      external_account_id: user.id,
      handle: user.username,
      display_name: user.name,
      avatar_url: user.profile_image_url,
      follower_count: metrics.followers_count,
      following_count: metrics.following_count,
      post_count: metrics.tweet_count,
      raw_response: response.raw_response,
      platform_status_code: response.platform_status_code,
      rate_limit: response.rate_limit,
    };
  }

  async createPost(input: {
    provider: "x_oauth1" | "x_oauth2" | "api_key";
    secret_ref: string;
    text: string;
  }): Promise<TwitterCreatedPost> {
    const response = await this.requestJson<{ id: string; text: string }>({
      method: "POST",
      path: "/2/tweets",
      provider: input.provider,
      secret_ref: input.secret_ref,
      endpoint_code: "post.create",
      body: {
        text: input.text,
      },
    });

    return {
      external_post_id: requireString(response.data.id, "data.id"),
      raw_response: response.raw_response,
      platform_status_code: response.platform_status_code,
      rate_limit: response.rate_limit,
    };
  }

  async replyToPost(input: {
    provider: "x_oauth1" | "x_oauth2" | "api_key";
    secret_ref: string;
    reply_to_external_post_id: string;
    text: string;
  }): Promise<TwitterReplyResult> {
    const response = await this.requestJson<{ id: string; text: string }>({
      method: "POST",
      path: "/2/tweets",
      provider: input.provider,
      secret_ref: input.secret_ref,
      endpoint_code: "post.reply",
      body: {
        text: input.text,
        reply: {
          in_reply_to_tweet_id: input.reply_to_external_post_id,
        },
      },
    });

    return {
      external_reply_id: requireString(response.data.id, "data.id"),
      raw_response: response.raw_response,
      platform_status_code: response.platform_status_code,
      rate_limit: response.rate_limit,
    };
  }

  async sendDirectMessage(input: {
    provider: "x_oauth1" | "x_oauth2" | "api_key";
    secret_ref: string;
    dm_conversation_id: string;
    text: string;
  }): Promise<TwitterDirectMessageResult> {
    const response = await this.requestJson<Record<string, unknown>>({
      method: "POST",
      path: `/2/dm_conversations/${encodeURIComponent(input.dm_conversation_id)}/messages`,
      provider: input.provider,
      secret_ref: input.secret_ref,
      endpoint_code: "dm.send",
      body: {
        text: input.text,
      },
    });
    const data = requireObject(response.data, "data");

    return {
      external_message_id: requireString(
        data.dm_event_id ?? data.id ?? data.event_id,
        "data.dm_event_id",
      ),
      external_thread_id: requireString(
        data.dm_conversation_id ?? data.conversation_id ?? input.dm_conversation_id,
        "data.dm_conversation_id",
      ),
      raw_response: response.raw_response,
      platform_status_code: response.platform_status_code,
      rate_limit: response.rate_limit,
    };
  }

  async listMentions(input: {
    provider: "x_oauth1" | "x_oauth2" | "api_key";
    secret_ref: string;
  }): Promise<TwitterInboxPullResult> {
    const authenticatedUser = await this.getAuthenticatedUser(input);
    const response = await this.requestJson<XApiTweet[]>({
      method: "GET",
      path: `/2/users/${authenticatedUser.id}/mentions`,
      provider: input.provider,
      secret_ref: input.secret_ref,
      endpoint_code: "mentions.list",
      empty_data: [],
      query: {
        "tweet.fields": "author_id,conversation_id,created_at,text",
        expansions: "author_id",
        "user.fields": "username",
        max_results: "100",
      },
    });
    const users = indexIncludedUsers(response.includes);

    return {
      messages: response.data.map((tweet) => ({
        external_message_id: requireString(tweet.id, "tweet.id"),
        external_thread_id: requireString(tweet.conversation_id, "tweet.conversation_id"),
        sender_handle: tweet.author_id ? users.get(tweet.author_id) : undefined,
        content: requireString(tweet.text, "tweet.text"),
        occurred_at: requireString(tweet.created_at, "tweet.created_at"),
        raw_payload: JSON.stringify(tweet),
      })),
      raw_response: response.raw_response,
      platform_status_code: response.platform_status_code,
      rate_limit: response.rate_limit,
    };
  }

  async listDirectMessages(input: {
    provider: "x_oauth1" | "x_oauth2" | "api_key";
    secret_ref: string;
  }): Promise<TwitterInboxPullResult> {
    const response = await this.requestJson<XApiDmEvent[]>({
      method: "GET",
      path: "/2/dm_events",
      provider: input.provider,
      secret_ref: input.secret_ref,
      endpoint_code: "dm.list",
      empty_data: [],
      query: {
        "dm_event.fields": "created_at,dm_conversation_id,sender_id,text",
        event_types: "MessageCreate",
        expansions: "sender_id",
        "user.fields": "username",
        max_results: "100",
      },
    });
    const users = indexIncludedUsers(response.includes);

    return {
      messages: response.data.map((event) => {
        if (event.event_type !== "MessageCreate") {
          throw new AppError("EXTERNAL_DEPENDENCY_ERROR", "X API returned unsupported direct-message event type", {
            details: {
              event_id: event.id,
              event_type: event.event_type,
            },
          });
        }

        return {
          external_message_id: requireString(event.id, "dm_event.id"),
          external_thread_id: requireString(event.dm_conversation_id, "dm_event.dm_conversation_id"),
          sender_handle: event.sender_id ? users.get(event.sender_id) : undefined,
          content: requireString(event.text, "dm_event.text"),
          occurred_at: requireString(event.created_at, "dm_event.created_at"),
          raw_payload: JSON.stringify(event),
        };
      }),
      raw_response: response.raw_response,
      platform_status_code: response.platform_status_code,
      rate_limit: response.rate_limit,
    };
  }

  async listUserPosts(input: {
    provider: "x_oauth1" | "x_oauth2" | "api_key";
    secret_ref: string;
    handle: string;
  }): Promise<TwitterTimelinePullResult> {
    const username = normalizeHandle(input.handle);
    const userResponse = await this.requestJson<XApiAuthenticatedUser>({
      method: "GET",
      path: `/2/users/by/username/${encodeURIComponent(username)}`,
      provider: input.provider,
      secret_ref: input.secret_ref,
      endpoint_code: "timeline.user.lookup",
      query: {
        "user.fields": "username,name",
      },
    });

    const user = userResponse.data;
    const timelineResponse = await this.requestJson<XApiTweet[]>({
      method: "GET",
      path: `/2/users/${requireString(user.id, "data.id")}/tweets`,
      provider: input.provider,
      secret_ref: input.secret_ref,
      endpoint_code: "timeline.user.posts",
      query: {
        "tweet.fields": "conversation_id,created_at,text",
        exclude: "retweets",
        max_results: "100",
      },
    });

    return {
      posts: timelineResponse.data.map((tweet) => ({
        external_post_id: requireString(tweet.id, "tweet.id"),
        handle: requireString(user.username, "data.username"),
        kind: tweet.conversation_id && tweet.conversation_id !== tweet.id ? "reply" : "post",
        content: requireString(tweet.text, "tweet.text"),
        occurred_at: requireString(tweet.created_at, "tweet.created_at"),
        raw_payload: JSON.stringify(tweet),
      })),
      raw_response: JSON.stringify({
        user: userResponse.data,
        posts: timelineResponse.data,
      }),
      platform_status_code: timelineResponse.platform_status_code,
      rate_limit: timelineResponse.rate_limit ?? userResponse.rate_limit,
    };
  }

  private async getAuthenticatedUser(input: {
    provider: "x_oauth1" | "x_oauth2" | "api_key";
    secret_ref: string;
  }): Promise<XApiAuthenticatedUser> {
    const response = await this.fetchAuthenticatedUser(input);
    return response.data;
  }

  private async fetchAuthenticatedUser(input: {
    provider: "x_oauth1" | "x_oauth2" | "api_key";
    secret_ref: string;
  }): Promise<XApiRequestResult<XApiAuthenticatedUser>> {
    return this.requestJson<XApiAuthenticatedUser>({
      method: "GET",
      path: "/2/users/me",
      provider: input.provider,
      secret_ref: input.secret_ref,
      endpoint_code: "account.profile.get",
      query: {
        "user.fields": "profile_image_url,public_metrics,username,name",
      },
    });
  }

  private async requestJson<TData>(input: {
    method: "GET" | "POST";
    path: string;
    provider: "x_oauth1" | "x_oauth2" | "api_key";
    secret_ref: string;
    endpoint_code: string;
    query?: Record<string, string>;
    body?: unknown;
    empty_data?: TData;
  }): Promise<XApiRequestResult<TData>> {
    const url = new URL(input.path, this.baseUrl);
    if (input.query) {
      for (const [key, value] of Object.entries(input.query)) {
        url.searchParams.set(key, value);
      }
    }

    return this.performJsonRequest(input, url, false);
  }

  private async performJsonRequest<TData>(
    input: {
      method: "GET" | "POST";
      path: string;
      provider: "x_oauth1" | "x_oauth2" | "api_key";
      secret_ref: string;
      endpoint_code: string;
      body?: unknown;
      empty_data?: TData;
    },
    url: URL,
    retriedAfterRefresh: boolean,
  ): Promise<XApiRequestResult<TData>> {
    const resolved = await this.resolveUserContextAuthorization(input.provider, input.secret_ref);
    const headers = this.buildHeaders(input.method, url, resolved.authorization);
    const body = input.body ? JSON.stringify(input.body) : undefined;

    let response: Response;
    try {
      response = await fetch(url, {
        method: input.method,
        headers,
        body,
        signal: AbortSignal.timeout(this.requestTimeoutMs),
      });
    } catch (error) {
      throw new AppError("EXTERNAL_DEPENDENCY_ERROR", `X API request failed before a response was received`, {
        cause: error,
        details: {
          connector_error_code: "X_NETWORK_ERROR",
          endpoint: input.path,
          method: input.method,
        },
      });
    }

    const rawResponse = await response.text();
    const parsed = parseJsonResponse(rawResponse);
    if (!response.ok) {
      if (response.status === 401 && resolved.oauth2 && !retriedAfterRefresh) {
        const refreshed = await this.refreshOAuth2AccessToken(resolved.oauth2.secret_ref, resolved.oauth2.secret);
        return this.performJsonRequest(
          {
            ...input,
            secret_ref: refreshed.secret_ref,
          },
          url,
          true,
        );
      }

      throw createXApiResponseError(response.status, input.path, parsed);
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new AppError("EXTERNAL_DEPENDENCY_ERROR", "X API response must be a JSON object", {
        details: {
          endpoint: input.path,
          method: input.method,
          raw_response: rawResponse,
        },
      });
    }

    const envelope = parsed as XApiEnvelope<TData>;
    if (typeof envelope.data === "undefined") {
      if (typeof input.empty_data !== "undefined") {
        return {
          data: input.empty_data,
          raw_response: rawResponse,
          platform_status_code: response.status.toString(),
          rate_limit: parseRateLimitSnapshot(response.headers, input.endpoint_code),
          includes: envelope.includes,
        };
      }

      throw new AppError("EXTERNAL_DEPENDENCY_ERROR", "X API response is missing data", {
        details: {
          endpoint: input.path,
          method: input.method,
          raw_response: rawResponse,
        },
      });
    }

    return {
      data: envelope.data,
      raw_response: rawResponse,
      platform_status_code: response.status.toString(),
      rate_limit: parseRateLimitSnapshot(response.headers, input.endpoint_code),
      includes: envelope.includes,
    };
  }

  private async resolveUserContextAuthorization(
    provider: "x_oauth1" | "x_oauth2" | "api_key",
    secretRef: string,
  ): Promise<ResolvedAuthorization> {
    if (provider === "x_oauth1") {
      const secret = await this.secretStore.readOAuth1Secret(secretRef);
      return {
        authorization: {
          type: "oauth1",
          access_token: secret.access_token,
          access_token_secret: secret.access_token_secret,
        },
      };
    }

    if (provider === "x_oauth2") {
      const secret = await this.getFreshOAuth2Secret(secretRef);
      return {
        authorization: {
          type: "bearer",
          access_token: secret.access_token,
        },
        oauth2: {
          secret_ref: secretRef,
          secret,
        },
      };
    }

    const secret = await this.secretStore.readApiKeySecret(secretRef);
    throw new AppError("EXTERNAL_DEPENDENCY_ERROR", "provider api_key cannot call user-context X endpoints", {
      details: {
        connector_error_code: "X_PERMISSION_DENIED",
        provider,
        bearer_token_present: Boolean(secret.bearer_token),
      },
    });
  }

  private buildHeaders(method: "GET" | "POST", url: URL, authorization: UserContextAuthorization): Headers {
    const headers = new Headers();
    headers.set("accept", "application/json");
    headers.set("content-type", "application/json");

    if (authorization.type === "bearer") {
      headers.set("authorization", `Bearer ${authorization.access_token}`);
      return headers;
    }

    headers.set("authorization", createOAuth1AuthorizationHeader({
      method,
      url,
      consumer_key: this.requireOAuth1ClientValue(this.config.api_key, "X_API_KEY"),
      consumer_secret: this.requireOAuth1ClientValue(this.config.api_secret, "X_API_SECRET"),
      token: authorization.access_token,
      token_secret: authorization.access_token_secret,
    }));
    return headers;
  }

  private async getFreshOAuth2Secret(secretRef: string): Promise<OAuth2CredentialSecret> {
    const secret = await this.secretStore.readOAuth2Secret(secretRef);
    if (!shouldRefreshOAuth2Secret(secret)) {
      return secret;
    }

    const refreshed = await this.refreshOAuth2AccessToken(secretRef, secret);
    return refreshed.secret;
  }

  private async refreshOAuth2AccessToken(
    secretRef: string,
    current: OAuth2CredentialSecret,
  ): Promise<{ secret_ref: string; secret: OAuth2CredentialSecret }> {
    const body = new URLSearchParams();
    body.set("grant_type", "refresh_token");
    body.set("refresh_token", current.refresh_token);
    body.set("client_id", this.config.oauth2_client_id);

    let response: Response;
    try {
      response = await fetch(new URL("/2/oauth2/token", this.baseUrl), {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          authorization: `Basic ${Buffer.from(
            `${this.config.oauth2_client_id}:${this.config.oauth2_client_secret}`,
          ).toString("base64")}`,
        },
        body,
        signal: AbortSignal.timeout(this.requestTimeoutMs),
      });
    } catch (error) {
      throw new AppError("EXTERNAL_DEPENDENCY_ERROR", "X OAuth2 token refresh failed before a response was received", {
        cause: error,
        details: {
          connector_error_code: "X_NETWORK_ERROR",
          endpoint: "/2/oauth2/token",
          method: "POST",
          operation: "oauth2.refresh",
        },
      });
    }

    const rawResponse = await response.text();
    const parsed = parseJsonResponse(rawResponse);
    if (!response.ok) {
      const message = extractXApiErrorMessage(parsed) ?? `X OAuth2 refresh failed with status ${response.status}`;
      throw new AppError("EXTERNAL_DEPENDENCY_ERROR", message, {
        details: {
          connector_error_code: normalizeConnectorError(response.status, message),
          endpoint: "/2/oauth2/token",
          method: "POST",
          operation: "oauth2.refresh",
          status_code: response.status,
        },
      });
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new AppError("EXTERNAL_DEPENDENCY_ERROR", "X OAuth2 refresh response must be a JSON object", {
        details: {
          endpoint: "/2/oauth2/token",
          method: "POST",
          raw_response: rawResponse,
          operation: "oauth2.refresh",
        },
      });
    }

    const payload = parsed as Record<string, unknown>;
    const refreshedAt = new Date().toISOString();
    const expiresIn = requireNumber(payload.expires_in, "expires_in");
    const secret = {
      access_token: requireString(payload.access_token, "access_token"),
      refresh_token: optionalString(payload.refresh_token) ?? current.refresh_token,
      token_type: requireString(payload.token_type, "token_type"),
      expires_at: new Date(Date.parse(refreshedAt) + expiresIn * 1000).toISOString(),
      refreshed_at: refreshedAt,
      scope: optionalString(payload.scope) ?? current.scope,
    } satisfies OAuth2CredentialSecret;

    const nextSecretRef = await this.secretStore.upsertOAuth2Secret(secretRef, secret);
    return {
      secret_ref: nextSecretRef,
      secret,
    };
  }

  private requireOAuth1ClientValue(value: string | undefined, envName: "X_API_KEY" | "X_API_SECRET"): string {
    if (!value || value.trim() === "") {
      throw new AppError("EXTERNAL_DEPENDENCY_ERROR", `${envName} is required for x_oauth1 requests`, {
        details: {
          dependency: envName,
          operation: "oauth1.request-signing",
        },
      });
    }

    return value.trim();
  }
}

function createXApiResponseError(statusCode: number, endpoint: string, payload: unknown): AppError {
  const message = extractXApiErrorMessage(payload) ?? `X API request failed with status ${statusCode}`;
  const connectorErrorCode = normalizeConnectorError(statusCode, message);

  return new AppError("EXTERNAL_DEPENDENCY_ERROR", message, {
    details: {
      connector_error_code: connectorErrorCode,
      endpoint,
      status_code: statusCode,
    },
  });
}

function parseJsonResponse(rawResponse: string): unknown {
  if (rawResponse.trim() === "") {
    return {};
  }

  try {
    return JSON.parse(rawResponse);
  } catch {
    return rawResponse;
  }
}

function parseRateLimitSnapshot(headers: Headers, windowKey: string): TwitterRateLimitSnapshot | undefined {
  const limit = Number(headers.get("x-rate-limit-limit"));
  const remaining = Number(headers.get("x-rate-limit-remaining"));
  const reset = Number(headers.get("x-rate-limit-reset"));

  if (!Number.isFinite(limit) || !Number.isFinite(remaining) || !Number.isFinite(reset)) {
    return undefined;
  }

  return {
    window_key: windowKey,
    limit_count: limit,
    remaining_count: remaining,
    resets_at: new Date(reset * 1000).toISOString(),
  };
}

function indexIncludedUsers(includes: Record<string, unknown> | undefined): Map<string, string> {
  const users = new Map<string, string>();
  const rawUsers = includes?.users;

  if (!Array.isArray(rawUsers)) {
    return users;
  }

  for (const value of rawUsers) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      continue;
    }

    const user = value as XApiIncludedUser;
    if (typeof user.id === "string" && typeof user.username === "string") {
      users.set(user.id, user.username);
    }
  }

  return users;
}

function requireUserPublicMetrics(value: unknown): XApiUserPublicMetrics {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AppError("EXTERNAL_DEPENDENCY_ERROR", "X API response is missing public_metrics", {
      details: {
        field: "public_metrics",
      },
    });
  }

  return {
    followers_count: requireNumber((value as Record<string, unknown>).followers_count, "public_metrics.followers_count"),
    following_count: requireNumber((value as Record<string, unknown>).following_count, "public_metrics.following_count"),
    tweet_count: requireNumber((value as Record<string, unknown>).tweet_count, "public_metrics.tweet_count"),
  };
}

function requireObject(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AppError("EXTERNAL_DEPENDENCY_ERROR", `X API response is missing ${field}`, {
      details: { field },
    });
  }

  return value as Record<string, unknown>;
}

function extractXApiErrorMessage(payload: unknown): string | undefined {
  if (!payload) {
    return undefined;
  }

  if (typeof payload === "string" && payload.trim() !== "") {
    return payload.trim();
  }

  if (typeof payload !== "object" || Array.isArray(payload)) {
    return undefined;
  }

  const envelope = payload as Record<string, unknown>;
  if (Array.isArray(envelope.errors) && envelope.errors.length > 0) {
    const firstError = envelope.errors[0];
    if (firstError && typeof firstError === "object" && !Array.isArray(firstError)) {
      const detail = (firstError as Record<string, unknown>).detail;
      const title = (firstError as Record<string, unknown>).title;
      if (typeof detail === "string" && detail.trim() !== "") {
        return detail.trim();
      }
      if (typeof title === "string" && title.trim() !== "") {
        return title.trim();
      }
    }
  }

  const detail = envelope.detail;
  if (typeof detail === "string" && detail.trim() !== "") {
    return detail.trim();
  }

  return undefined;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new AppError("EXTERNAL_DEPENDENCY_ERROR", `X API response is missing ${field}`, {
      details: { field },
    });
  }

  return value.trim();
}

function normalizeHandle(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
}

function requireNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new AppError("EXTERNAL_DEPENDENCY_ERROR", `X API response is missing ${field}`, {
      details: { field },
    });
  }

  return value;
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }

  return value.trim();
}

function shouldRefreshOAuth2Secret(secret: OAuth2CredentialSecret): boolean {
  const expiresAt = Date.parse(secret.expires_at);
  if (!Number.isFinite(expiresAt)) {
    return true;
  }

  return expiresAt <= Date.now() + 60_000;
}
