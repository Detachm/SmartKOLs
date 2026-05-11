import { NextResponse } from "next/server";
import {
  buildXAuthorizeUrl,
  createOAuthStartSession,
  getOAuthCookieMaxAgeSeconds,
  getOAuthCookieName,
  serializeOAuthSessionCookie,
} from "@/lib/server/x-oauth";
import { shouldUseSecureCookies } from "@/lib/server/live-session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const config = loadOAuthStartConfig();
  const url = new URL(request.url);
  const accountId = url.searchParams.get("account_id")?.trim() || undefined;
  const workspaceId = url.searchParams.get("workspace_id")?.trim() || undefined;
  const workspaceSlug = url.searchParams.get("workspace_slug")?.trim() || undefined;
  const session = createOAuthStartSession({ accountId, workspaceId, workspaceSlug });
  const location = buildXAuthorizeUrl(config, session);

  const response = NextResponse.redirect(location, { status: 302 });
  response.headers.set("cache-control", "no-store");
  response.cookies.set({
    name: getOAuthCookieName(session.state),
    value: serializeOAuthSessionCookie(session, config.stateSecret),
    httpOnly: true,
    secure: shouldUseSecureCookies(request),
    sameSite: "lax",
    path: "/auth/x",
    maxAge: getOAuthCookieMaxAgeSeconds(),
  });
  response.cookies.set({
    name: getOAuthCookieName(),
    value: serializeOAuthSessionCookie(session, config.stateSecret),
    httpOnly: true,
    secure: shouldUseSecureCookies(request),
    sameSite: "lax",
    path: "/auth/x",
    maxAge: getOAuthCookieMaxAgeSeconds(),
  });
  return response;
}

function loadOAuthStartConfig() {
  const clientId = requireEnv("X_CLIENT_ID");
  const redirectUri = requireEnv("X_REDIRECT_URI");
  const stateSecret = requireEnv("X_AUTH_STATE_SECRET");
  const scopes = [
    "tweet.read",
    "tweet.write",
    "users.read",
    "follows.write",
    "dm.read",
    "dm.write",
    "offline.access",
  ];

  return {
    clientId,
    redirectUri,
    stateSecret,
    scopes,
  };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`${name} is required`);
  }

  return value.trim();
}
