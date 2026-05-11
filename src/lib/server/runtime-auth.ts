import { NextResponse } from "next/server";
import { readLiveSessionFromRequest, type LiveSessionCookieValue } from "@/lib/server/live-session";

export function isLocalAuthEnabled(): boolean {
  const configured = process.env.SMARTKOLS_LOCAL_AUTH_ENABLED?.trim().toLowerCase();
  if (configured === "true") {
    return true;
  }
  if (configured === "false") {
    return false;
  }

  return process.env.NODE_ENV !== "production";
}

export function requireLiveSession(request: Request): LiveSessionCookieValue | NextResponse {
  const session = readLiveSessionFromRequest(request);
  if (session) {
    return session;
  }

  return NextResponse.json({
    ok: false,
    error: {
      code: "UNAUTHORIZED",
      message: "session not found",
    },
  }, { status: 401 });
}

export function localAuthDisabledResponse(): NextResponse {
  return NextResponse.json({
    ok: false,
    error: {
      code: "FORBIDDEN",
      message: "local auth is disabled",
    },
  }, { status: 403 });
}
