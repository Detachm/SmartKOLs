import { NextResponse } from "next/server";
import { relayBackendJson } from "@/lib/server/backend-api";
import { withBackendSessionHeaders } from "@/lib/server/backend-session";
import { isLocalAuthEnabled, localAuthDisabledResponse, requireLiveSession } from "@/lib/server/runtime-auth";

export async function GET(request: Request) {
  const session = requireLiveSession(request);
  if (session instanceof NextResponse) {
    return session;
  }

  const response = await relayBackendJson("/workspaces", {
    headers: withBackendSessionHeaders(undefined, session),
  });
  return NextResponse.json(response.body, { status: response.status });
}

export async function POST(request: Request) {
  let session = null;
  if (!isLocalAuthEnabled()) {
    const liveSession = requireLiveSession(request);
    if (liveSession instanceof NextResponse) {
      return localAuthDisabledResponse();
    }
    session = liveSession;
  }

  const payload = await request.text();
  const response = await relayBackendJson("/workspaces", {
    method: "POST",
    headers: withBackendSessionHeaders({
      "content-type": "application/json; charset=utf-8",
    }, session instanceof NextResponse ? null : session),
    body: payload,
  });

  return NextResponse.json(response.body, { status: response.status });
}
