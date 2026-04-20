import { NextResponse } from "next/server";
import { relayBackendJson } from "@/lib/server/backend-api";
import { withBackendSessionHeaders } from "@/lib/server/backend-session";
import { isLocalAuthEnabled, localAuthDisabledResponse, requireLiveSession } from "@/lib/server/runtime-auth";

interface Params {
  params: Promise<{
    backendPath: string[];
  }>;
}

async function relayRequest(method: string, request: Request, context: Params) {
  const { backendPath } = await context.params;
  const pathname = `/${backendPath.map((segment) => encodeURIComponent(segment)).join("/")}`;
  let session = null;
  if (pathname === "/local-auth/bootstrap") {
    if (!isLocalAuthEnabled()) {
      return localAuthDisabledResponse();
    }
  } else {
    const liveSession = requireLiveSession(request);
    if (liveSession instanceof NextResponse) {
      return liveSession;
    }
    session = liveSession;
  }

  const url = new URL(request.url);
  const searchParams = new URLSearchParams(url.searchParams);
  const contentType = request.headers.get("content-type");

  const init: RequestInit = {
    method,
    headers: withBackendSessionHeaders(contentType ? { "content-type": contentType } : undefined, session),
  };

  if (!["GET", "HEAD"].includes(method)) {
    init.body = await request.text();
  }

  const response = await relayBackendJson(pathname, init, searchParams);
  return NextResponse.json(response.body, { status: response.status });
}

export async function GET(request: Request, context: Params) {
  return relayRequest("GET", request, context);
}

export async function POST(request: Request, context: Params) {
  return relayRequest("POST", request, context);
}

export async function PUT(request: Request, context: Params) {
  return relayRequest("PUT", request, context);
}

export async function DELETE(request: Request, context: Params) {
  return relayRequest("DELETE", request, context);
}
