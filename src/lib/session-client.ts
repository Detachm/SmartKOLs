export interface LiveSessionUser {
  id: string;
  email: string;
  name: string;
  status: "active" | "disabled";
  created_at: string;
}

export interface LiveSessionWorkspace {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended" | "closed";
  created_at: string;
  updated_at: string;
}

export interface LiveSessionMembership {
  workspace: LiveSessionWorkspace;
  role_code: "owner" | "admin" | "editor" | "viewer";
  joined_at: string;
}

export interface LiveSessionResponse {
  user: LiveSessionUser;
  selected_workspace: LiveSessionWorkspace;
  selected_role_code: LiveSessionMembership["role_code"];
  workspaces: LiveSessionMembership[];
}

export const LIVE_SESSION_CHANGED_EVENT = "smartkols:live-session-changed";

function dispatchLiveSessionChanged(detail: LiveSessionResponse | null) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent<LiveSessionResponse | null>(LIVE_SESSION_CHANGED_EVENT, {
    detail,
  }));
}

async function readSessionResponse(response: Response): Promise<LiveSessionResponse> {
  const payload = await response.json() as LiveSessionResponse | { message?: string };
  if (!response.ok) {
    throw new Error("message" in payload && payload.message ? payload.message : `session request failed: ${response.status}`);
  }

  return payload as LiveSessionResponse;
}

export async function getLiveSession(): Promise<LiveSessionResponse> {
  const response = await fetch("/api/session", { cache: "no-store" });
  return readSessionResponse(response);
}

export async function loginLocalSession(payload: {
  email: string;
  name: string;
  workspace_slug: string;
}): Promise<LiveSessionResponse> {
  const response = await fetch("/api/session", {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(payload),
  });
  const session = await readSessionResponse(response);
  dispatchLiveSessionChanged(session);
  return session;
}

export async function switchLiveSessionWorkspace(workspaceId: string): Promise<LiveSessionResponse> {
  const response = await fetch("/api/session", {
    method: "PUT",
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ workspace_id: workspaceId }),
  });
  const session = await readSessionResponse(response);
  dispatchLiveSessionChanged(session);
  return session;
}

export async function logoutLiveSession(): Promise<void> {
  const response = await fetch("/api/session", {
    method: "DELETE",
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ message: "logout failed" })) as { message?: string };
    throw new Error(payload.message ?? "logout failed");
  }

  dispatchLiveSessionChanged(null);
}
