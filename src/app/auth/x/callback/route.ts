import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  deserializeOAuthSessionCookie,
  exchangeOAuthCodeForToken,
  fetchAuthenticatedXUser,
  getOAuthCookieName,
} from "@/lib/server/x-oauth";
import { getBackendProxySharedSecret } from "@/lib/server/backend-api";
import { withBackendSessionHeaders } from "@/lib/server/backend-session";
import { clearLiveSessionCookie, readLiveSessionFromRequest } from "@/lib/server/live-session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code")?.trim() || "";
  const state = url.searchParams.get("state")?.trim() || "";
  const error = url.searchParams.get("error")?.trim() || "";
  const errorDescription = url.searchParams.get("error_description")?.trim() || "";
  const config = loadOAuthCallbackConfig();

  const cookieStore = cookies();
  const cookieValue = cookieStore.get(getOAuthCookieName(state))?.value
    ?? cookieStore.get(getOAuthCookieName())?.value;
  const session = deserializeOAuthSessionCookie(cookieValue, config.stateSecret);

  if (!session) {
    return respondText("OAuth callback failed: missing or invalid auth session cookie.", 400);
  }

  if (error) {
    return respondText(`OAuth callback failed: ${error}${errorDescription ? ` - ${errorDescription}` : ""}`, 400);
  }

  if (!code) {
    return respondText("OAuth callback failed: missing authorization code.", 400);
  }

  if (state !== session.state) {
    return respondText("OAuth callback failed: state mismatch.", 400);
  }

  try {
    const token = await exchangeOAuthCodeForToken(
      {
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        redirectUri: config.redirectUri,
      },
      {
        code,
        codeVerifier: session.codeVerifier,
      },
    );

    const smartkolsPayload = buildSmartKolsCredentialPayload(token);
    const backendBaseUrl = requireEnv("SMARTKOLS_BACKEND_BASE_URL");
    const liveSession = readLiveSessionFromRequest(request);
    const accountId = session.accountId
      ?? (liveSession
        ? await resolveOrCreateAccountIdFromAuthenticatedUser({
            backendBaseUrl,
            liveSession,
            token,
          })
        : session.workspaceId
          ? await resolveOrCreateAccountIdFromWorkspace({
              backendBaseUrl,
              workspaceId: session.workspaceId,
              token,
            })
          : session.workspaceSlug
            ? await resolveOrCreateAccountIdFromWorkspaceSlug({
                backendBaseUrl,
                workspaceSlug: session.workspaceSlug,
                token,
              })
        : undefined);
    const binding = accountId
      ? await bindCredentialToSmartKOLsAccount({
          backendBaseUrl,
          request,
          accountId,
          payload: smartkolsPayload,
        })
      : undefined;

    const successUrl = buildPublicUrl(request, "/login");
    successUrl.searchParams.set("connected", "1");
    successUrl.searchParams.set("next", "/accounts");
    if (binding?.account_id) {
      successUrl.searchParams.set("account_id", binding.account_id);
    }

    const response = NextResponse.redirect(successUrl, { status: 302 });
    response.headers.set("cache-control", "no-store");
    response.cookies.set({
      name: getOAuthCookieName(state),
      value: "",
      path: "/auth/x",
      maxAge: 0,
    });
    response.cookies.set({
      name: getOAuthCookieName(),
      value: "",
      path: "/auth/x",
      maxAge: 0,
    });
    clearLiveSessionCookie(response, request);
    return response;
  } catch (cause) {
    return respondText(
      cause instanceof Error ? `OAuth callback failed: ${cause.message}` : "OAuth callback failed.",
      500,
    );
  }
}

function buildPublicUrl(request: Request, pathname: string): URL {
  const requestUrl = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host")?.trim() || requestUrl.host;
  const protocol = forwardedProto || requestUrl.protocol.replace(/:$/, "");

  return new URL(pathname, `${protocol}://${host}`);
}

function buildSmartKolsCredentialPayload(token: {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in?: number;
  scope?: string;
}) {
  if (!token.refresh_token || token.refresh_token.trim() === "") {
    throw new Error("OAuth callback failed: X did not return refresh_token. Ensure offline.access scope is enabled.");
  }

  if (typeof token.expires_in !== "number" || !Number.isFinite(token.expires_in) || token.expires_in <= 0) {
    throw new Error("OAuth callback failed: X did not return a valid expires_in.");
  }

  return {
    provider: "x_oauth2" as const,
    status: "valid" as const,
    oauth2_token: {
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      token_type: token.token_type,
      expires_in: token.expires_in,
      scope: token.scope,
    },
  };
}

async function bindCredentialToSmartKOLsAccount(input: {
  backendBaseUrl: string;
  request: Request;
  accountId: string;
  payload: ReturnType<typeof buildSmartKolsCredentialPayload>;
}) {
  const liveSession = readLiveSessionFromRequest(input.request);
  const proxySharedSecret = getBackendProxySharedSecret();
  const proxyHeaders = withBackendSessionHeaders({
    accept: "application/json",
  }, liveSession);
  if (proxySharedSecret) {
    proxyHeaders.set("x-smartkols-proxy-secret", proxySharedSecret);
  }
  const surfaceUrl = new URL(`/accounts/${encodeURIComponent(input.accountId)}/surface`, input.backendBaseUrl);
  const surfaceResponse = await fetch(surfaceUrl, {
    method: "GET",
    headers: proxyHeaders,
    cache: "no-store",
  });
  const surfaceBody = await readResponseBody(surfaceResponse);
  if (!surfaceResponse.ok) {
    throw new Error(
      `OAuth callback failed: SmartKOLs account surface lookup returned ${surfaceResponse.status}: ${formatErrorPayload(surfaceBody)}`,
    );
  }

  if (liveSession) {
    const workspaceId = extractWorkspaceId(surfaceBody);
    if (workspaceId !== liveSession.workspace_id) {
      throw new Error("OAuth callback failed: current session cannot bind credentials for the requested account.");
    }
  }

  const upsertUrl = new URL(`/accounts/${encodeURIComponent(input.accountId)}/credentials`, input.backendBaseUrl);
  const upsertResponse = await fetch(upsertUrl, {
    method: "POST",
    headers: Object.fromEntries(withBackendSessionHeaders({
      "content-type": "application/json; charset=utf-8",
      accept: "application/json",
      ...(proxySharedSecret ? { "x-smartkols-proxy-secret": proxySharedSecret } : {}),
    }, liveSession).entries()),
    body: JSON.stringify(input.payload),
    cache: "no-store",
  });

  const raw = await upsertResponse.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = raw;
  }

  if (!upsertResponse.ok) {
    throw new Error(
      `OAuth callback failed: SmartKOLs credential bind returned ${upsertResponse.status}: ${formatErrorPayload(parsed)}`,
    );
  }

  const validateUrl = new URL(`/accounts/${encodeURIComponent(input.accountId)}/credentials/validate`, input.backendBaseUrl);
  const validateResponse = await fetch(validateUrl, {
    method: "POST",
    headers: Object.fromEntries(withBackendSessionHeaders({
      accept: "application/json",
      ...(proxySharedSecret ? { "x-smartkols-proxy-secret": proxySharedSecret } : {}),
    }, liveSession).entries()),
    cache: "no-store",
  });
  const validateBody = await readResponseBody(validateResponse);
  if (!validateResponse.ok) {
    throw new Error(
      `OAuth callback failed: SmartKOLs credential validate returned ${validateResponse.status}: ${formatErrorPayload(validateBody)}`,
    );
  }

  const syncProfileUrl = new URL(`/accounts/${encodeURIComponent(input.accountId)}/profile/sync`, input.backendBaseUrl);
  const syncProfileResponse = await fetch(syncProfileUrl, {
    method: "POST",
    headers: Object.fromEntries(withBackendSessionHeaders({
      accept: "application/json",
      ...(proxySharedSecret ? { "x-smartkols-proxy-secret": proxySharedSecret } : {}),
    }, liveSession).entries()),
    cache: "no-store",
  });
  const syncProfileBody = await readResponseBody(syncProfileResponse);
  if (!syncProfileResponse.ok) {
    throw new Error(
      `OAuth callback failed: SmartKOLs profile sync returned ${syncProfileResponse.status}: ${formatErrorPayload(syncProfileBody)}`,
    );
  }

  return {
    account_id: input.accountId,
    endpoint: upsertUrl.toString(),
    credential_upsert: parsed,
    credential_validate: validateBody,
    profile_sync: syncProfileBody,
  };
}

async function resolveOrCreateAccountIdFromAuthenticatedUser(input: {
  backendBaseUrl: string;
  liveSession: { user_id: string; workspace_id: string };
  token: {
    access_token: string;
    refresh_token?: string;
    token_type: string;
    expires_in?: number;
    scope?: string;
  };
}): Promise<string> {
  const profile = await fetchAuthenticatedXUser(input.token);
  const normalizedHandle = normalizeHandle(profile.username);
  const proxySharedSecret = getBackendProxySharedSecret();
  const headers = withBackendSessionHeaders({
    accept: "application/json",
    ...(proxySharedSecret ? { "x-smartkols-proxy-secret": proxySharedSecret } : {}),
  }, input.liveSession);

  const surfaceUrl = new URL(`/workspaces/${encodeURIComponent(input.liveSession.workspace_id)}/surface`, input.backendBaseUrl);
  const surfaceResponse = await fetch(surfaceUrl, {
    method: "GET",
    headers,
    cache: "no-store",
  });
  const surfaceBody = await readResponseBody(surfaceResponse);
  if (!surfaceResponse.ok) {
    throw new Error(
      `OAuth callback failed: workspace surface lookup returned ${surfaceResponse.status}: ${formatErrorPayload(surfaceBody)}`,
    );
  }

  const existingAccountId = extractExistingAccountId(surfaceBody, normalizedHandle, profile.id);
  if (existingAccountId) {
    return existingAccountId;
  }

  const createUrl = new URL("/accounts", input.backendBaseUrl);
  const createResponse = await fetch(createUrl, {
    method: "POST",
    headers: Object.fromEntries(withBackendSessionHeaders({
      "content-type": "application/json; charset=utf-8",
      accept: "application/json",
      ...(proxySharedSecret ? { "x-smartkols-proxy-secret": proxySharedSecret } : {}),
    }, input.liveSession).entries()),
    body: JSON.stringify({
      workspace_id: input.liveSession.workspace_id,
      platform: "x",
      handle: normalizedHandle,
      display_name: profile.name,
      avatar_url: profile.profile_image_url,
      external_account_id: profile.id,
    }),
    cache: "no-store",
  });
  const createBody = await readResponseBody(createResponse);
  if (createResponse.ok) {
    return extractRequiredAccountId(createBody, "OAuth callback failed: account create returned malformed payload.");
  }

  if (shouldRetryAccountLookup(createResponse.status, createBody)) {
    const refreshedSurfaceResponse = await fetch(surfaceUrl, {
      method: "GET",
      headers,
      cache: "no-store",
    });
    const refreshedSurfaceBody = await readResponseBody(refreshedSurfaceResponse);
    if (!refreshedSurfaceResponse.ok) {
      throw new Error(
        `OAuth callback failed: workspace surface reload returned ${refreshedSurfaceResponse.status}: ${formatErrorPayload(refreshedSurfaceBody)}`,
      );
    }

    const conflictedAccountId = extractExistingAccountId(refreshedSurfaceBody, normalizedHandle, profile.id);
    if (conflictedAccountId) {
      return conflictedAccountId;
    }
  }

  throw new Error(
    `OAuth callback failed: account create returned ${createResponse.status}: ${formatErrorPayload(createBody)}`,
  );
}

async function resolveOrCreateAccountIdFromWorkspace(input: {
  backendBaseUrl: string;
  workspaceId: string;
  token: {
    access_token: string;
    refresh_token?: string;
    token_type: string;
    expires_in?: number;
    scope?: string;
  };
}): Promise<string> {
  const profile = await fetchAuthenticatedXUser(input.token);
  const normalizedHandle = normalizeHandle(profile.username);
  const proxySharedSecret = getBackendProxySharedSecret();
  const headers = new Headers({
    accept: "application/json",
  });
  if (proxySharedSecret) {
    headers.set("x-smartkols-proxy-secret", proxySharedSecret);
  }

  const surfaceUrl = new URL(`/workspaces/${encodeURIComponent(input.workspaceId)}/surface`, input.backendBaseUrl);
  const surfaceResponse = await fetch(surfaceUrl, {
    method: "GET",
    headers,
    cache: "no-store",
  });
  const surfaceBody = await readResponseBody(surfaceResponse);
  if (!surfaceResponse.ok) {
    throw new Error(
      `OAuth callback failed: workspace surface lookup returned ${surfaceResponse.status}: ${formatErrorPayload(surfaceBody)}`,
    );
  }

  const existingAccountId = extractExistingAccountId(surfaceBody, normalizedHandle, profile.id);
  if (existingAccountId) {
    return existingAccountId;
  }

  const createUrl = new URL("/accounts", input.backendBaseUrl);
  const createResponse = await fetch(createUrl, {
    method: "POST",
    headers: Object.fromEntries(new Headers({
      "content-type": "application/json; charset=utf-8",
      accept: "application/json",
      ...(proxySharedSecret ? { "x-smartkols-proxy-secret": proxySharedSecret } : {}),
    }).entries()),
    body: JSON.stringify({
      workspace_id: input.workspaceId,
      platform: "x",
      handle: normalizedHandle,
      display_name: profile.name,
      avatar_url: profile.profile_image_url,
      external_account_id: profile.id,
    }),
    cache: "no-store",
  });
  const createBody = await readResponseBody(createResponse);
  if (createResponse.ok) {
    return extractRequiredAccountId(createBody, "OAuth callback failed: account create returned malformed payload.");
  }

  if (shouldRetryAccountLookup(createResponse.status, createBody)) {
    const refreshedSurfaceResponse = await fetch(surfaceUrl, {
      method: "GET",
      headers,
      cache: "no-store",
    });
    const refreshedSurfaceBody = await readResponseBody(refreshedSurfaceResponse);
    if (!refreshedSurfaceResponse.ok) {
      throw new Error(
        `OAuth callback failed: workspace surface reload returned ${refreshedSurfaceResponse.status}: ${formatErrorPayload(refreshedSurfaceBody)}`,
      );
    }

    const conflictedAccountId = extractExistingAccountId(refreshedSurfaceBody, normalizedHandle, profile.id);
    if (conflictedAccountId) {
      return conflictedAccountId;
    }
  }

  throw new Error(
    `OAuth callback failed: account create returned ${createResponse.status}: ${formatErrorPayload(createBody)}`,
  );
}

async function resolveOrCreateAccountIdFromWorkspaceSlug(input: {
  backendBaseUrl: string;
  workspaceSlug: string;
  token: {
    access_token: string;
    refresh_token?: string;
    token_type: string;
    expires_in?: number;
    scope?: string;
  };
}): Promise<string> {
  const proxySharedSecret = getBackendProxySharedSecret();
  const headers = new Headers({
    accept: "application/json",
  });
  if (proxySharedSecret) {
    headers.set("x-smartkols-proxy-secret", proxySharedSecret);
  }

  const workspacesUrl = new URL("/workspaces", input.backendBaseUrl);
  const workspacesResponse = await fetch(workspacesUrl, {
    method: "GET",
    headers,
    cache: "no-store",
  });
  const workspacesBody = await readResponseBody(workspacesResponse);
  if (!workspacesResponse.ok) {
    throw new Error(
      `OAuth callback failed: workspace list lookup returned ${workspacesResponse.status}: ${formatErrorPayload(workspacesBody)}`,
    );
  }

  const workspaceId = extractWorkspaceIdBySlug(workspacesBody, input.workspaceSlug);
  if (!workspaceId) {
    throw new Error(`OAuth callback failed: workspace slug not found: ${input.workspaceSlug}`);
  }

  return resolveOrCreateAccountIdFromWorkspace({
    backendBaseUrl: input.backendBaseUrl,
    workspaceId,
    token: input.token,
  });
}

function shouldRetryAccountLookup(status: number, payload: unknown): boolean {
  if (status === 409) {
    return true;
  }

  if (status !== 400) {
    return false;
  }

  const message = formatErrorPayload(payload).toLowerCase();
  return message.includes("already exists");
}

function extractWorkspaceId(value: unknown): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  if (!record.ok || !record.data || typeof record.data !== "object" || Array.isArray(record.data)) {
    return undefined;
  }

  const data = record.data as Record<string, unknown>;
  const workspace = data.workspace;
  if (!workspace || typeof workspace !== "object" || Array.isArray(workspace)) {
    return undefined;
  }

  const workspaceId = (workspace as Record<string, unknown>).id;
  return typeof workspaceId === "string" && workspaceId.trim() !== "" ? workspaceId.trim() : undefined;
}

async function readResponseBody(response: Response): Promise<unknown> {
  const raw = await response.text();
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function formatErrorPayload(value: unknown): string {
  if (typeof value === "string" && value.trim() !== "") {
    return value.trim();
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "unknown backend response";
  }

  const record = value as Record<string, unknown>;
  const message = record.error && typeof record.error === "object" && !Array.isArray(record.error)
    ? (record.error as Record<string, unknown>).message
    : undefined;
  if (typeof message === "string" && message.trim() !== "") {
    return message.trim();
  }

  return JSON.stringify(value);
}

function loadOAuthCallbackConfig() {
  return {
    clientId: requireEnv("X_CLIENT_ID"),
    clientSecret: requireEnv("X_CLIENT_SECRET"),
    redirectUri: requireEnv("X_REDIRECT_URI"),
    stateSecret: requireEnv("X_AUTH_STATE_SECRET"),
  };
}

function normalizeHandle(value: string): string {
  return `@${value.trim().replace(/^@+/, "").toLowerCase()}`;
}

function extractExistingAccountId(payload: unknown, normalizedHandle: string, externalAccountId: string): string | undefined {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return undefined;
  }

  const record = payload as Record<string, unknown>;
  const candidateContainer = record.data && typeof record.data === "object" && !Array.isArray(record.data)
    ? record.data as Record<string, unknown>
    : record;
  const activeAccounts = candidateContainer.active_accounts;
  if (!Array.isArray(activeAccounts)) {
    return undefined;
  }

  for (const item of activeAccounts) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }
    const account = item as Record<string, unknown>;
    if (typeof account.id !== "string") {
      continue;
    }
    if (typeof account.external_account_id === "string" && account.external_account_id === externalAccountId) {
      return account.id;
    }
    if (typeof account.handle === "string" && normalizeHandle(account.handle) === normalizedHandle) {
      return account.id;
    }
  }

  return undefined;
}

function extractRequiredAccountId(payload: unknown, fallbackMessage: string): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error(fallbackMessage);
  }

  const record = payload as Record<string, unknown>;
  const directId = record.id;
  if (typeof directId === "string" && directId.trim() !== "") {
    return directId;
  }

  const wrappedData = record.data;
  if (wrappedData && typeof wrappedData === "object" && !Array.isArray(wrappedData)) {
    const wrappedId = (wrappedData as Record<string, unknown>).id;
    if (typeof wrappedId === "string" && wrappedId.trim() !== "") {
      return wrappedId;
    }
  }

  throw new Error(fallbackMessage);
}

function extractWorkspaceIdBySlug(payload: unknown, workspaceSlug: string): string | undefined {
  const normalizedSlug = workspaceSlug.trim().toLowerCase();
  if (!normalizedSlug || !payload || typeof payload !== "object" || Array.isArray(payload)) {
    return undefined;
  }

  const record = payload as Record<string, unknown>;
  const container = record.data && typeof record.data === "object" && !Array.isArray(record.data)
    ? record.data as Record<string, unknown>
    : record;
  const workspaces = container.workspaces;
  if (!Array.isArray(workspaces)) {
    return undefined;
  }

  for (const item of workspaces) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }

    const workspace = item as Record<string, unknown>;
    const slug = typeof workspace.slug === "string" ? workspace.slug.trim().toLowerCase() : "";
    const id = typeof workspace.id === "string" ? workspace.id.trim() : "";
    if (slug === normalizedSlug && id) {
      return id;
    }
  }

  return undefined;
}

function respondText(message: string, status: number) {
  return new NextResponse(message, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`${name} is required`);
  }

  return value.trim();
}
