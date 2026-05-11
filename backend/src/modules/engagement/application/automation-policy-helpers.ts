import type { ConnectorRequest } from "../../connector-x/domain/connector-request";

export function countSucceededToday(
  requests: ConnectorRequest[],
  endpointCode: string,
  nowIso: string,
) {
  const today = nowIso.slice(0, 10);
  return requests.filter((request) =>
    request.endpoint_code === endpointCode
      && request.status === "succeeded"
      && (request.finished_at ?? request.started_at).slice(0, 10) === today).length;
}

export function parseRequestPayload(request: ConnectorRequest): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(request.request_payload) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function extractSucceededPayloadStrings(
  requests: ConnectorRequest[],
  endpointCode: string,
  field: string,
) {
  return new Set(
    requests
      .filter((request) => request.endpoint_code === endpointCode && request.status === "succeeded")
      .map((request) => {
        const payload = parseRequestPayload(request);
        return typeof payload?.[field] === "string" ? payload[field].trim().toLowerCase() : "";
      })
      .filter((value) => value !== ""),
  );
}

export function normalizeHandle(handle: string) {
  const trimmed = handle.trim();
  if (trimmed === "") {
    return "";
  }

  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

export function normalizeHandleKey(handle: string) {
  return normalizeHandle(handle).toLowerCase();
}

export function uniqueNonEmptyStrings(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter((item) => item !== "")));
}

export function splitHandlesAndQueries(items: string[]) {
  const normalized = uniqueNonEmptyStrings(items);
  const handles: string[] = [];
  const queries: string[] = [];

  for (const item of normalized) {
    if (item.startsWith("@")) {
      handles.push(normalizeHandle(item));
    } else {
      queries.push(item);
    }
  }

  return { handles, queries };
}

export function deterministicDelayMs(seed: string, minMinutes: number, maxMinutes: number) {
  const safeMin = Math.max(0, Math.trunc(minMinutes));
  const safeMax = Math.max(safeMin, Math.trunc(maxMinutes));
  const spread = safeMax - safeMin;
  if (spread === 0) {
    return safeMin * 60_000;
  }

  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = ((hash * 31) + seed.charCodeAt(index)) >>> 0;
  }

  const offset = hash % (spread + 1);
  return (safeMin + offset) * 60_000;
}

export function addMilliseconds(iso: string, milliseconds: number) {
  return new Date(new Date(iso).getTime() + milliseconds).toISOString();
}

export function addMinutes(iso: string, minutes: number) {
  return addMilliseconds(iso, minutes * 60_000);
}

export function pickDeterministicIndex(seed: string, length: number) {
  if (length <= 1) {
    return 0;
  }

  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = ((hash * 131) + seed.charCodeAt(index)) >>> 0;
  }

  return hash % length;
}
