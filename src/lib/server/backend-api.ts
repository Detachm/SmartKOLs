const DEFAULT_DEV_PROXY_SHARED_SECRET = "smartkols-dev-proxy-secret";

export function getBackendBaseUrl(): string {
  const value = process.env.SMARTKOLS_BACKEND_BASE_URL?.trim();
  if (!value) {
    throw new Error("SMARTKOLS_BACKEND_BASE_URL is required");
  }

  return value.replace(/\/$/, "");
}

export function getBackendProxySharedSecret(): string | undefined {
  const value = process.env.SMARTKOLS_BACKEND_SHARED_SECRET?.trim();
  if (value) {
    return value;
  }

  if (process.env.NODE_ENV !== "production") {
    return DEFAULT_DEV_PROXY_SHARED_SECRET;
  }

  return undefined;
}

export async function requestBackend(pathname: string, init?: RequestInit, searchParams?: URLSearchParams): Promise<Response> {
  const url = new URL(pathname, getBackendBaseUrl());
  if (searchParams) {
    searchParams.forEach((value, key) => {
      url.searchParams.set(key, value);
    });
  }

  const headers = new Headers(init?.headers);
  const proxySharedSecret = getBackendProxySharedSecret();
  if (proxySharedSecret) {
    headers.set("x-smartkols-proxy-secret", proxySharedSecret);
  }

  return fetch(url, {
    ...init,
    headers,
    cache: "no-store",
  });
}

export async function relayBackendJson(pathname: string, init?: RequestInit, searchParams?: URLSearchParams) {
  const response = await requestBackend(pathname, init, searchParams);
  const raw = await response.text();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { ok: false, error: { code: "INTERNAL_ERROR", message: raw || "non-json backend response" } };
  }

  return {
    status: response.status,
    body: parsed,
  };
}

export async function readBackendJson<T>(pathname: string, init?: RequestInit, searchParams?: URLSearchParams): Promise<T> {
  const response = await requestBackend(pathname, init, searchParams);
  const raw = await response.text();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = raw;
  }

  if (!response.ok) {
    throw new Error(`Backend request failed: ${response.status} ${formatBackendError(parsed)}`);
  }

  return parsed as T;
}

function formatBackendError(value: unknown): string {
  if (typeof value === "string" && value.trim() !== "") {
    return value.trim();
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "unknown backend error";
  }

  const record = value as Record<string, unknown>;
  const error = record.error;
  if (error && typeof error === "object" && !Array.isArray(error)) {
    const message = (error as Record<string, unknown>).message;
    if (typeof message === "string" && message.trim() !== "") {
      return message.trim();
    }
  }

  return JSON.stringify(value);
}
