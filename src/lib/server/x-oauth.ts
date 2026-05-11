import crypto from "crypto";

const AUTH_COOKIE_NAME = "smartkols_x_oauth";
const AUTH_COOKIE_TTL_SECONDS = 60 * 10;
const X_OAUTH_REQUEST_TIMEOUT_MS = 20_000;

export interface OAuthStartConfig {
  clientId: string;
  redirectUri: string;
  scopes: string[];
}

export interface OAuthStartSession {
  state: string;
  codeVerifier: string;
  codeChallenge: string;
  createdAt: string;
  accountId?: string;
  workspaceId?: string;
  workspaceSlug?: string;
}

export interface OAuthTokenConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface OAuthTokenResult {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in?: number;
  scope?: string;
}

export interface XAuthenticatedUserProfile {
  id: string;
  username: string;
  name: string;
  profile_image_url?: string;
}

export function buildXAuthorizeUrl(config: OAuthStartConfig, session: OAuthStartSession): string {
  const url = new URL("https://twitter.com/i/oauth2/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", config.scopes.join(" "));
  url.searchParams.set("state", session.state);
  url.searchParams.set("code_challenge", session.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export function createOAuthStartSession(input?: { accountId?: string; workspaceId?: string; workspaceSlug?: string }): OAuthStartSession {
  const state = crypto.randomBytes(16).toString("hex");
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");

  return {
    state,
    codeVerifier,
    codeChallenge,
    createdAt: new Date().toISOString(),
    accountId: input?.accountId?.trim() || undefined,
    workspaceId: input?.workspaceId?.trim() || undefined,
    workspaceSlug: input?.workspaceSlug?.trim() || undefined,
  };
}

export function serializeOAuthSessionCookie(session: OAuthStartSession, secret: string): string {
  const payload = JSON.stringify({
    state: session.state,
    codeVerifier: session.codeVerifier,
      createdAt: session.createdAt,
      accountId: session.accountId,
      workspaceId: session.workspaceId,
      workspaceSlug: session.workspaceSlug,
    });
  const signature = sign(payload, secret);
  return Buffer.from(JSON.stringify({ payload, signature }), "utf8").toString("base64url");
}

export function deserializeOAuthSessionCookie(cookieValue: string | undefined, secret: string): null | {
  state: string;
  codeVerifier: string;
  createdAt: string;
  accountId?: string;
  workspaceId?: string;
  workspaceSlug?: string;
} {
  if (!cookieValue || cookieValue.trim() === "") {
    return null;
  }

  try {
    const decoded = Buffer.from(cookieValue, "base64url").toString("utf8");
    const envelope = JSON.parse(decoded) as { payload?: string; signature?: string };
    if (!envelope.payload || !envelope.signature) {
      return null;
    }

    if (sign(envelope.payload, secret) !== envelope.signature) {
      return null;
    }

    const parsed = JSON.parse(envelope.payload) as {
      state?: string;
      codeVerifier?: string;
      createdAt?: string;
      accountId?: string;
      workspaceId?: string;
      workspaceSlug?: string;
    };
    if (!parsed.state || !parsed.codeVerifier || !parsed.createdAt) {
      return null;
    }

    return {
      state: parsed.state,
      codeVerifier: parsed.codeVerifier,
      createdAt: parsed.createdAt,
      accountId: typeof parsed.accountId === "string" && parsed.accountId.trim() !== "" ? parsed.accountId.trim() : undefined,
      workspaceId: typeof parsed.workspaceId === "string" && parsed.workspaceId.trim() !== "" ? parsed.workspaceId.trim() : undefined,
      workspaceSlug: typeof parsed.workspaceSlug === "string" && parsed.workspaceSlug.trim() !== "" ? parsed.workspaceSlug.trim() : undefined,
    };
  } catch {
    return null;
  }
}

export async function exchangeOAuthCodeForToken(
  config: OAuthTokenConfig,
  input: {
    code: string;
    codeVerifier: string;
  },
): Promise<OAuthTokenResult> {
  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("code", input.code);
  body.set("redirect_uri", config.redirectUri);
  body.set("client_id", config.clientId);
  body.set("code_verifier", input.codeVerifier);

  let response: Response;
  try {
    response = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        accept: "application/json",
        "accept-encoding": "identity",
        "content-type": "application/x-www-form-urlencoded",
        authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(X_OAUTH_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new Error(`X token exchange network failure: ${formatFetchError(error)}`);
  }

  const raw = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`X token endpoint returned non-JSON response: ${raw}`);
  }

  if (!response.ok) {
    const message = isRecord(parsed) && typeof parsed.error_description === "string"
      ? parsed.error_description
      : raw;
    throw new Error(`X token exchange failed: ${message}`);
  }

  if (!isRecord(parsed) || typeof parsed.access_token !== "string" || typeof parsed.token_type !== "string") {
    throw new Error(`X token exchange returned invalid payload: ${raw}`);
  }

  return {
    access_token: parsed.access_token,
    refresh_token: typeof parsed.refresh_token === "string" ? parsed.refresh_token : undefined,
    token_type: parsed.token_type,
    expires_in: typeof parsed.expires_in === "number" ? parsed.expires_in : undefined,
    scope: typeof parsed.scope === "string" ? parsed.scope : undefined,
  };
}

export async function fetchAuthenticatedXUser(token: OAuthTokenResult): Promise<XAuthenticatedUserProfile> {
  let response: Response;
  try {
    response = await fetch(
      "https://api.twitter.com/2/users/me?user.fields=profile_image_url",
      {
        headers: {
          accept: "application/json",
          "accept-encoding": "identity",
          authorization: `Bearer ${token.access_token}`,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(X_OAUTH_REQUEST_TIMEOUT_MS),
      },
    );
  } catch (error) {
    throw new Error(`X users/me network failure: ${formatFetchError(error)}`);
  }

  const raw = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`X users/me returned non-JSON response: ${raw}`);
  }

  if (!response.ok) {
    throw new Error(`X users/me failed: ${raw}`);
  }

  if (!isRecord(parsed) || !isRecord(parsed.data)) {
    throw new Error(`X users/me returned invalid payload: ${raw}`);
  }

  const data = parsed.data;
  if (typeof data.id !== "string" || typeof data.username !== "string" || typeof data.name !== "string") {
    throw new Error(`X users/me returned incomplete profile: ${raw}`);
  }

  return {
    id: data.id,
    username: data.username,
    name: data.name,
    profile_image_url: typeof data.profile_image_url === "string" ? data.profile_image_url : undefined,
  };
}

export function getOAuthCookieName(state?: string): string {
  const normalizedState = normalizeCookieState(state);
  if (!normalizedState) {
    return AUTH_COOKIE_NAME;
  }

  return `${AUTH_COOKIE_NAME}_${normalizedState}`;
}

export function getOAuthCookieMaxAgeSeconds(): number {
  return AUTH_COOKIE_TTL_SECONDS;
}

function sign(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatFetchError(error: unknown): string {
  if (error instanceof Error) {
    const cause = "cause" in error ? (error as Error & { cause?: unknown }).cause : undefined;
    if (cause instanceof Error) {
      return `${error.name}: ${error.message}; cause=${cause.name}: ${cause.message}`;
    }

    return `${error.name}: ${error.message}`;
  }

  return String(error);
}

function normalizeCookieState(state: string | undefined): string | undefined {
  if (!state) {
    return undefined;
  }

  const normalized = state.trim();
  if (!normalized) {
    return undefined;
  }

  return /^[A-Za-z0-9_-]{8,128}$/.test(normalized) ? normalized : undefined;
}
