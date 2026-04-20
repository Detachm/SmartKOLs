import crypto from "crypto";

const AUTH_COOKIE_NAME = "smartkols_x_oauth";
const AUTH_COOKIE_TTL_SECONDS = 60 * 10;

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

export function createOAuthStartSession(input?: { accountId?: string }): OAuthStartSession {
  const state = crypto.randomBytes(16).toString("hex");
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");

  return {
    state,
    codeVerifier,
    codeChallenge,
    createdAt: new Date().toISOString(),
    accountId: input?.accountId?.trim() || undefined,
  };
}

export function serializeOAuthSessionCookie(session: OAuthStartSession, secret: string): string {
  const payload = JSON.stringify({
    state: session.state,
    codeVerifier: session.codeVerifier,
    createdAt: session.createdAt,
    accountId: session.accountId,
  });
  const signature = sign(payload, secret);
  return Buffer.from(JSON.stringify({ payload, signature }), "utf8").toString("base64url");
}

export function deserializeOAuthSessionCookie(cookieValue: string | undefined, secret: string): null | {
  state: string;
  codeVerifier: string;
  createdAt: string;
  accountId?: string;
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
    };
    if (!parsed.state || !parsed.codeVerifier || !parsed.createdAt) {
      return null;
    }

    return {
      state: parsed.state,
      codeVerifier: parsed.codeVerifier,
      createdAt: parsed.createdAt,
      accountId: typeof parsed.accountId === "string" && parsed.accountId.trim() !== "" ? parsed.accountId.trim() : undefined,
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

  const response = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
    },
    body,
  });

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

export function getOAuthCookieName(): string {
  return AUTH_COOKIE_NAME;
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
