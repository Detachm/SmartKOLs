import { requireNonEmptyString } from "../../../core/validation/guards";

export interface ModelRequestAttempt {
  id: string;
  model_request_id: string;
  attempt_no: number;
  provider_request_id?: string;
  raw_response_ref?: string;
  parsed_output?: string;
  validation_error?: string;
  error_code?: string;
  error_message?: string;
  started_at: string;
  finished_at?: string;
}

export function createModelRequestAttempt(input: ModelRequestAttempt): ModelRequestAttempt {
  return {
    id: requireNonEmptyString(input.id, "id"),
    model_request_id: requireNonEmptyString(input.model_request_id, "model_request_id"),
    attempt_no: input.attempt_no,
    provider_request_id: input.provider_request_id?.trim() || undefined,
    raw_response_ref: input.raw_response_ref?.trim() || undefined,
    parsed_output: input.parsed_output?.trim() || undefined,
    validation_error: input.validation_error?.trim() || undefined,
    error_code: input.error_code?.trim() || undefined,
    error_message: input.error_message?.trim() || undefined,
    started_at: requireNonEmptyString(input.started_at, "started_at"),
    finished_at: input.finished_at?.trim() || undefined,
  };
}
