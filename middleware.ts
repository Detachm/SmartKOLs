import { NextResponse, type NextRequest } from "next/server";
import { LIVE_SESSION_COOKIE } from "@/lib/server/live-session";

function isProtectedPath(pathname: string): boolean {
  return pathname === "/dashboard"
    || pathname === "/calendar"
    || pathname === "/drafts"
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
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (isProtectedPath(pathname) && !hasSession) {
    const loginUrl = new URL("/login", request.url);
    const nextPath = `${pathname}${search}`;
    if (nextPath !== "/login") {
      loginUrl.searchParams.set("next", nextPath);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
