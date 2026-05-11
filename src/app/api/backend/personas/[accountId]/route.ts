import { NextResponse } from "next/server";
import { relayBackendJson } from "@/lib/server/backend-api";
import { withBackendSessionHeaders } from "@/lib/server/backend-session";
import { requireLiveSession } from "@/lib/server/runtime-auth";

interface Params {
  params: Promise<{
    accountId: string;
  }>;
}

export async function GET(_request: Request, context: Params) {
  const session = requireLiveSession(_request);
  if (session instanceof NextResponse) {
    return session;
  }

  const { accountId } = await context.params;
  const response = await relayBackendJson(`/personas/${encodeURIComponent(accountId)}`, {
    headers: withBackendSessionHeaders(undefined, session),
  });
  return NextResponse.json(response.body, { status: response.status });
}

export async function PUT(request: Request, context: Params) {
  const session = requireLiveSession(request);
  if (session instanceof NextResponse) {
    return session;
  }

  const { accountId } = await context.params;
  const payload = await request.text();
  const response = await relayBackendJson(`/personas/${encodeURIComponent(accountId)}`, {
    method: "PUT",
    headers: withBackendSessionHeaders({
      "content-type": "application/json; charset=utf-8",
    }, session),
    body: payload,
  });

  return NextResponse.json(response.body, { status: response.status });
}
