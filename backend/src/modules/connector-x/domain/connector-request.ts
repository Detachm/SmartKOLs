import { requireNonEmptyString, requireOneOf } from "../../../core/validation/guards";

export type ConnectorRequestStatus = "running" | "succeeded" | "failed" | "rate_limited";

export interface ConnectorRequest {
  id: string;
  workspace_id: string;
  request_id?: string;
  account_id: string;
  credential_id: string;
  endpoint_code: string;
  idempotency_key?: string;
  request_payload: string;
  response_payload?: string;
  platform_status_code?: string;
  status: ConnectorRequestStatus;
  error_code?: string;
  error_message?: string;
  started_at: string;
  finished_at?: string;
}

export function createConnectorRequest(request: ConnectorRequest): ConnectorRequest {
  return {
    id: requireNonEmptyString(request.id, "id"),
    workspace_id: requireNonEmptyString(request.workspace_id, "workspace_id"),
    request_id: request.request_id?.trim() || undefined,
    account_id: requireNonEmptyString(request.account_id, "account_id"),
    credential_id: requireNonEmptyString(request.credential_id, "credential_id"),
    endpoint_code: requireNonEmptyString(request.endpoint_code, "endpoint_code"),
    idempotency_key: request.idempotency_key?.trim() || undefined,
    request_payload: requireNonEmptyString(request.request_payload, "request_payload"),
    response_payload: request.response_payload?.trim() || undefined,
    platform_status_code: request.platform_status_code?.trim() || undefined,
    status: requireOneOf(request.status, "status", ["running", "succeeded", "failed", "rate_limited"] as const),
    error_code: request.error_code?.trim() || undefined,
    error_message: request.error_message?.trim() || undefined,
    started_at: requireNonEmptyString(request.started_at, "started_at"),
    finished_at: request.finished_at?.trim() || undefined,
  };
}
