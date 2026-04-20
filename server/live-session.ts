import type { NextRequest, NextResponse } from "next/server";

export const LIVE_SESSION_COOKIE = "smartkols_session";

export interface LiveSessionCookieValue {
  user_id: string;
  workspace_id: string;
}

export function parseLiveSessionCookie(rawValue: string | undefined): LiveSessionCookieValue | null {
  if (!rawValue) {
    return null;
  }

  const [userId, workspaceId] = rawValue.split("|");
  if (!userId || !workspaceId) {
    return null;
  }

  return {
    user_id: decodeURIComponent(userId),
    workspace_id: decodeURIComponent(workspaceId),
  };
}

export function readLiveSessionFromRequest(request: Request | NextRequest): LiveSessionCookieValue | null {
  const cookieHeader = "cookies" in request
    ? request.cookies.get(LIVE_SESSION_COOKIE)?.value
    : undefined;

  if (cookieHeader !== undefined) {
    return parseLiveSessionCookie(cookieHeader);
  }

  const rawHeader = request.headers.get("cookie") ?? "";
  const matchedCookie = rawHeader
    .split(";")
    .map((chunk) => chunk.trim())
    .find((chunk) => chunk.startsWith(`${LIVE_SESSION_COOKIE}=`));

  if (!matchedCookie) {
    return null;
  }

  return parseLiveSessionCookie(matchedCookie.slice(`${LIVE_SESSION_COOKIE}=`.length));
}

export function shouldUseSecureCookies(request?: Request | NextRequest): boolean {
  const configured = process.env.SMARTKOLS_SECURE_COOKIES?.trim().toLowerCase();
  if (configured === "true") {
    return true;
  }
  if (configured === "false") {
    return false;
  }

  if (request) {
    try {
      return new URL(request.url).protocol === "https:";
    } catch {
      return process.env.NODE_ENV === "production";
    }
  }

  return process.env.NODE_ENV === "production";
}

export function writeLiveSessionCookie(
  response: NextResponse,
  value: LiveSessionCookieValue,
  request?: Request | NextRequest,
): void {
  response.cookies.set({
    name: LIVE_SESSION_COOKIE,
    value: `${encodeURIComponent(value.user_id)}|${encodeURIComponent(value.workspace_id)}`,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: shouldUseSecureCookies(request),
  });
}

export function clearLiveSessionCookie(response: NextResponse, request?: Request | NextRequest): void {
  response.cookies.set({
    name: LIVE_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: shouldUseSecureCookies(request),
    expires: new Date(0),
  });
}
