export type ErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INVALID_STATE"
  | "EXTERNAL_DEPENDENCY_ERROR"
  | "MODEL_TIMEOUT"
  | "MODEL_RATE_LIMITED"
  | "MODEL_UPSTREAM_5XX"
  | "MODEL_NETWORK_ERROR"
  | "MODEL_INVALID_OUTPUT"
  | "MODEL_SCHEMA_VIOLATION"
  | "MODEL_TOOL_PLAN_INVALID"
  | "SOURCE_FETCH_TIMEOUT"
  | "SOURCE_FETCH_RATE_LIMITED"
  | "SOURCE_FETCH_UPSTREAM_5XX"
  | "SOURCE_FETCH_NETWORK_ERROR"
  | "SOURCE_FETCH_INVALID_RESPONSE"
  | "SOURCE_FETCH_SCHEMA_VIOLATION"
  | "SOURCE_FETCH_UNSUPPORTED"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;
  readonly causeError?: unknown;

  constructor(code: ErrorCode, message: string, options?: { details?: Record<string, unknown>; cause?: unknown }) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.details = options?.details;
    this.causeError = options?.cause;
  }
}
