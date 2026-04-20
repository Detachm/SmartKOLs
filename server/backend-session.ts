import type { LiveSessionCookieValue } from "@/lib/server/live-session";

const USER_ID_HEADER = "x-smartkols-user-id";
const WORKSPACE_ID_HEADER = "x-smartkols-workspace-id";

export function withBackendSessionHeaders(
  headers: HeadersInit | undefined,
  session: LiveSessionCookieValue | null,
): Headers {
  const nextHeaders = new Headers(headers);
  if (!session) {
    return nextHeaders;
  }

  nextHeaders.set(USER_ID_HEADER, session.user_id);
  nextHeaders.set(WORKSPACE_ID_HEADER, session.workspace_id);
  return nextHeaders;
}
