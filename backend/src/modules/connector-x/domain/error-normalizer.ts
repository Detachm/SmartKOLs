export type ConnectorErrorCode =
  | "X_AUTH_INVALID"
  | "X_AUTH_EXPIRED"
  | "X_RATE_LIMITED"
  | "X_PERMISSION_DENIED"
  | "X_RESOURCE_NOT_FOUND"
  | "X_DUPLICATE_ACTION"
  | "X_NETWORK_ERROR"
  | "X_UPSTREAM_5XX"
  | "X_UNKNOWN_OUTCOME";

export function normalizeConnectorError(statusCode: number | undefined, detail?: string): ConnectorErrorCode {
  const normalizedDetail = detail?.trim().toLowerCase();

  if (statusCode === 401 && normalizedDetail?.includes("expired")) return "X_AUTH_EXPIRED";
  if (statusCode === 401) return "X_AUTH_INVALID";
  if (statusCode === 403) return "X_PERMISSION_DENIED";
  if (statusCode === 404) return "X_RESOURCE_NOT_FOUND";
  if (statusCode === 409) return "X_DUPLICATE_ACTION";
  if (statusCode === 429) return "X_RATE_LIMITED";
  if (typeof statusCode === "number" && statusCode >= 500) return "X_UPSTREAM_5XX";
  return "X_UNKNOWN_OUTCOME";
}
