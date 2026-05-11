import { NextResponse } from "next/server";
import { clearLiveSessionCookie, readLiveSessionFromRequest, writeLiveSessionCookie } from "@/lib/server/live-session";
import { isLocalAuthEnabled } from "@/lib/server/runtime-auth";

interface SessionContextResponse {
  user: {
    id: string;
    email: string;
    name: string;
    status: "active" | "disabled";
    created_at: string;
  };
  workspaces: Array<{
    workspace: {
      id: string;
      name: string;
      slug: string;
      status: "active" | "suspended" | "closed";
      created_at: string;
      updated_at: string;
    };
    role_code: "owner" | "admin" | "editor" | "viewer";
    joined_at: string;
  }>;
}

function sessionError(status: number, message: string) {
  return NextResponse.json({ message }, { status });
}

async function fetchBackendJson<T>(request: Request, path: string, init?: RequestInit): Promise<T> {
  const internalAppBaseUrl = getInternalAppBaseUrl(request);
  const url = new URL(`/api/backend${path}`, internalAppBaseUrl);
  const cookieHeader = request.headers.get("cookie");
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const payload = await response.json() as {
    ok: boolean;
    data?: T;
    error?: { message: string };
  };

  if (!response.ok || !payload.ok || !payload.data) {
    throw new Error(payload.error?.message ?? `request failed: ${response.status}`);
  }

  return payload.data;
}

function getInternalAppBaseUrl(request: Request): string {
  const configured = process.env.INTERNAL_APP_BASE_URL?.trim();
  if (configured) {
    return configured;
  }

  try {
    const parsed = new URL(request.url);
    const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const host = forwardedHost || request.headers.get("host")?.trim() || parsed.host;
    const protocol = forwardedProto || parsed.protocol.replace(/:$/, "");
    return `${protocol}://${host}`;
  } catch {
    const port = process.env.PORT?.trim() || "3000";
    return `http://127.0.0.1:${port}`;
  }
}

export async function GET(request: Request) {
  const session = readLiveSessionFromRequest(request);
  if (!session) {
    return sessionError(401, "session not found");
  }

  try {
    const context = await fetchBackendJson<SessionContextResponse>(
      request,
      `/users/${encodeURIComponent(session.user_id)}/session-context`,
    );
    const selectedWorkspace = context.workspaces.find((item) => item.workspace.id === session.workspace_id);
    if (!selectedWorkspace) {
      const response = sessionError(401, "selected workspace is no longer accessible");
      clearLiveSessionCookie(response, request);
      return response;
    }

    return NextResponse.json({
      user: context.user,
      selected_workspace: selectedWorkspace.workspace,
      selected_role_code: selectedWorkspace.role_code,
      workspaces: context.workspaces,
    });
  } catch (error) {
    const response = sessionError(401, error instanceof Error ? error.message : "session bootstrap failed");
    clearLiveSessionCookie(response, request);
    return response;
  }
}

export async function POST(request: Request) {
  if (!isLocalAuthEnabled()) {
    return sessionError(403, "local auth is disabled");
  }

  const body = await request.json() as {
    email: string;
    name: string;
    workspace_slug: string;
  };

  try {
    const context = await fetchBackendJson<SessionContextResponse>(
      request,
      "/local-auth/bootstrap",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
    const selectedWorkspace = context.workspaces.find((item) => item.workspace.slug === body.workspace_slug);
    if (!selectedWorkspace) {
      return sessionError(400, "selected workspace is not part of the returned session context");
    }

    const response = NextResponse.json({
      user: context.user,
      selected_workspace: selectedWorkspace.workspace,
      selected_role_code: selectedWorkspace.role_code,
      workspaces: context.workspaces,
    });
    writeLiveSessionCookie(response, {
      user_id: context.user.id,
      workspace_id: selectedWorkspace.workspace.id,
    }, request);
    return response;
  } catch (error) {
    return sessionError(400, error instanceof Error ? error.message : "login failed");
  }
}

export async function PUT(request: Request) {
  const session = readLiveSessionFromRequest(request);
  if (!session) {
    return sessionError(401, "session not found");
  }

  const body = await request.json() as { workspace_id: string };
  try {
    const context = await fetchBackendJson<SessionContextResponse>(
      request,
      `/users/${encodeURIComponent(session.user_id)}/session-context`,
    );
    const selectedWorkspace = context.workspaces.find((item) => item.workspace.id === body.workspace_id);
    if (!selectedWorkspace) {
      return sessionError(403, "workspace is not accessible to the current user");
    }

    const response = NextResponse.json({
      user: context.user,
      selected_workspace: selectedWorkspace.workspace,
      selected_role_code: selectedWorkspace.role_code,
      workspaces: context.workspaces,
    });
    writeLiveSessionCookie(response, {
      user_id: context.user.id,
      workspace_id: selectedWorkspace.workspace.id,
    }, request);
    return response;
  } catch (error) {
    return sessionError(400, error instanceof Error ? error.message : "workspace switch failed");
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  clearLiveSessionCookie(response);
  return response;
}
