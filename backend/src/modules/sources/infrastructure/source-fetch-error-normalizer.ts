import { AppError } from "../../../core/errors/app-error";

const SOURCE_FETCH_ERROR_CODES = new Set([
  "SOURCE_FETCH_TIMEOUT",
  "SOURCE_FETCH_RATE_LIMITED",
  "SOURCE_FETCH_UPSTREAM_5XX",
  "SOURCE_FETCH_NETWORK_ERROR",
  "SOURCE_FETCH_INVALID_RESPONSE",
  "SOURCE_FETCH_SCHEMA_VIOLATION",
  "SOURCE_FETCH_UNSUPPORTED",
  "EXTERNAL_DEPENDENCY_ERROR",
]);

export function normalizeSourceFetchError(error: unknown): AppError {
  if (error instanceof AppError && SOURCE_FETCH_ERROR_CODES.has(error.code)) {
    return error;
  }

  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return new AppError("SOURCE_FETCH_TIMEOUT", "source fetch request timed out", { cause: error });
    }

    const message = error.message.toLowerCase();
    if (message.includes("429") || message.includes("rate limit")) {
      return new AppError("SOURCE_FETCH_RATE_LIMITED", "source fetch provider rate limited request", { cause: error });
    }
    if (message.includes("502") || message.includes("503") || message.includes("504") || message.includes("upstream")) {
      return new AppError("SOURCE_FETCH_UPSTREAM_5XX", "source fetch provider upstream failed", { cause: error });
    }
    if (message.includes("network") || message.includes("fetch failed") || message.includes("econn")) {
      return new AppError("SOURCE_FETCH_NETWORK_ERROR", "source fetch provider network request failed", { cause: error });
    }
  }

  return new AppError("EXTERNAL_DEPENDENCY_ERROR", "source fetch failed", { cause: error });
}
