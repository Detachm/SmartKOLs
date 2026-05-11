import { NextResponse, type NextRequest } from "next/server";
import { LIVE_SESSION_COOKIE } from "@/lib/server/live-session";

function isProtectedPath(pathname: string): boolean {
  return pathname === "/dashboard"
    || pathname === "/calendar"
    || pathname === "/drafts"
    || pathname === "/ai-bd"
    || pathname === "/monitoring"
    || pathname === "/settings"
    || pathname === "/accounts"
    || pathname.startsWith("/accounts/");
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/api") || pathname.startsWith("/_next") || pathname === "/favicon.ico") {
    return NextResponse.next();
  }

  const hasSession = Boolean(request.cookies.get(LIVE_SESSION_COOKIE)?.value);

  if (pathname === "/login" && hasSession) {
    return NextResponse.redirect(buildExternalUrl(request, "/dashboard"));
  }

  if (isProtectedPath(pathname) && !hasSession) {
    const loginUrl = buildExternalUrl(request, "/login");
    const nextPath = `${pathname}${search}`;
    if (nextPath !== "/login") {
      loginUrl.searchParams.set("next", nextPath);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

function buildExternalUrl(request: NextRequest, pathname: string): URL {
  const forwardedHost = request.headers.get("x-forwarded-host")?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.trim();

  if (forwardedHost) {
    return new URL(`${forwardedProto || "https"}://${forwardedHost}${pathname}`);
  }

  return new URL(pathname, request.url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
