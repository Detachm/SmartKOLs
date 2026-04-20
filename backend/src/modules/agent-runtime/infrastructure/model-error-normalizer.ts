import { AppError } from "../../../core/errors/app-error";

const MODEL_ERROR_CODES = new Set([
  "MODEL_TIMEOUT",
  "MODEL_RATE_LIMITED",
  "MODEL_UPSTREAM_5XX",
  "MODEL_NETWORK_ERROR",
  "MODEL_INVALID_OUTPUT",
  "MODEL_SCHEMA_VIOLATION",
  "MODEL_TOOL_PLAN_INVALID",
  "EXTERNAL_DEPENDENCY_ERROR",
]);

export function normalizeModelProviderError(error: unknown): AppError {
  if (error instanceof AppError && MODEL_ERROR_CODES.has(error.code)) {
    return error;
  }

  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return new AppError("MODEL_TIMEOUT", "model provider request timed out", { cause: error });
    }

    const message = error.message.toLowerCase();
    if (message.includes("429") || message.includes("rate limit")) {
      return new AppError("MODEL_RATE_LIMITED", "model provider rate limited request", { cause: error });
    }
    if (message.includes("502") || message.includes("503") || message.includes("504") || message.includes("upstream")) {
      return new AppError("MODEL_UPSTREAM_5XX", "model provider upstream failed", { cause: error });
    }
    if (message.includes("network") || message.includes("fetch failed") || message.includes("econn")) {
      return new AppError("MODEL_NETWORK_ERROR", "model provider network request failed", { cause: error });
    }
  }

  return new AppError("EXTERNAL_DEPENDENCY_ERROR", "model provider request failed", { cause: error });
}

export function isInvalidModelOutputError(error: AppError): boolean {
  return error.code === "MODEL_INVALID_OUTPUT"
    || error.code === "MODEL_SCHEMA_VIOLATION"
    || error.code === "MODEL_TOOL_PLAN_INVALID";
}
