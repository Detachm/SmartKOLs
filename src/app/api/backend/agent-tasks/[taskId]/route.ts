import { NextResponse } from "next/server";
import { relayBackendJson } from "@/lib/server/backend-api";
import { withBackendSessionHeaders } from "@/lib/server/backend-session";
import { requireLiveSession } from "@/lib/server/runtime-auth";

interface Params {
  params: Promise<{
    taskId: string;
  }>;
}

export async function GET(_request: Request, context: Params) {
  const session = requireLiveSession(_request);
  if (session instanceof NextResponse) {
    return session;
  }

  const { taskId } = await context.params;
  const response = await relayBackendJson(`/agent-tasks/${encodeURIComponent(taskId)}`, {
    headers: withBackendSessionHeaders(undefined, session),
  });
  return NextResponse.json(response.body, { status: response.status });
}
