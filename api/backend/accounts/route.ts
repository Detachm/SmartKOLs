import { NextResponse } from "next/server";
import { relayBackendJson } from "@/lib/server/backend-api";
import { withBackendSessionHeaders } from "@/lib/server/backend-session";
import { requireLiveSession } from "@/lib/server/runtime-auth";

export async function GET(request: Request) {
  const session = requireLiveSession(request);
  if (session instanceof NextResponse) {
    return session;
  }

  const url = new URL(request.url);
  const searchParams = new URLSearchParams();
  const workspaceId = url.searchParams.get("workspace_id")?.trim();
  searchParams.set("workspace_id", workspaceId || session.workspace_id);

  const response = await relayBackendJson(
    "/accounts",
    { headers: withBackendSessionHeaders(undefined, session) },
    searchParams,
  );
  return NextResponse.json(response.body, { status: response.status });
}

export async function POST(request: Request) {
  const session = requireLiveSession(request);
  if (session instanceof NextResponse) {
    return session;
  }

  const payload = await request.text();
  const response = await relayBackendJson("/accounts", {
    method: "POST",
    headers: withBackendSessionHeaders({
      "content-type": "application/json; charset=utf-8",
    }, session),
    body: payload,
  });

  return NextResponse.json(response.body, { status: response.status });
}
