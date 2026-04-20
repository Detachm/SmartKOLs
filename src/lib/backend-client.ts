export interface BackendErrorPayload {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export type BackendResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: BackendErrorPayload;
    };

export interface BackendWorkspace {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended" | "closed";
  created_at: string;
  updated_at: string;
}

export interface BackendAccount {
  id: string;
  workspace_id: string;
  group_id?: string;
  platform: "x";
  handle: string;
  display_name: string;
  avatar_url?: string;
  status: "active" | "paused" | "disabled" | "error";
  follower_count: number;
  following_count: number;
  post_count: number;
  external_account_id?: string;
  created_at: string;
  updated_at: string;
}

export interface BackendAccountGroup {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
  created_at: string;
}

export async function requestBackendResult<T>(path: string, init?: RequestInit): Promise<{
  status: number;
  result: BackendResult<T>;
}> {
  const response = await fetch(path, {
    cache: "no-store",
    ...init,
  });

  return {
    status: response.status,
    result: await response.json() as BackendResult<T>,
  };
}

export async function getBackendData<T>(path: string): Promise<T> {
  const { result } = await requestBackendResult<T>(path);
  return unwrapBackendResult<T>(result);
}

export async function postBackendData<T>(path: string, payload: unknown): Promise<T> {
  const { result } = await requestBackendResult<T>(path, {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(payload),
  });

  return unwrapBackendResult<T>(result);
}

export async function putBackendData<T>(path: string, payload: unknown): Promise<T> {
  const { result } = await requestBackendResult<T>(path, {
    method: "PUT",
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(payload),
  });

  return unwrapBackendResult<T>(result);
}

export async function deleteBackendData<T>(path: string): Promise<T> {
  const { result } = await requestBackendResult<T>(path, {
    method: "DELETE",
  });

  return unwrapBackendResult<T>(result);
}

function unwrapBackendResult<T>(value: BackendResult<T>): T {
  if (value.ok) {
    return value.data;
  }

  throw new Error(value.error.message);
}
