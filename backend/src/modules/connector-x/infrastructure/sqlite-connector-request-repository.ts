import type { SqliteExecutor } from "../../../infrastructure/db/sqlite-executor";
import type { RequestContextStore } from "../../../core/request-context/request-context";
import type { ConnectorRequestRepository } from "../application/ports/connector-request-repository";
import type { ConnectorRequest } from "../domain/connector-request";

export class SqliteConnectorRequestRepository implements ConnectorRequestRepository {
  constructor(
    private readonly db: SqliteExecutor,
    private readonly requestContext: RequestContextStore,
  ) {}

  async create(request: ConnectorRequest): Promise<void> {
    const requestId = request.request_id ?? this.requestContext.getRequestId() ?? null;
    this.db.run(
      `INSERT INTO connector_requests (
        id, workspace_id, request_id, account_id, credential_id, endpoint_code, idempotency_key,
        request_payload, response_payload, platform_status_code, status, error_code,
        error_message, started_at, finished_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        request.id,
        request.workspace_id,
        requestId,
        request.account_id,
        request.credential_id,
        request.endpoint_code,
        request.idempotency_key ?? null,
        request.request_payload,
        request.response_payload ?? null,
        request.platform_status_code ?? null,
        request.status,
        request.error_code ?? null,
        request.error_message ?? null,
        request.started_at,
        request.finished_at ?? null,
      ],
    );
  }

  async save(request: ConnectorRequest): Promise<void> {
    const requestId = request.request_id ?? this.requestContext.getRequestId() ?? null;
    this.db.run(
      `UPDATE connector_requests
      SET request_id = ?, response_payload = ?, platform_status_code = ?, status = ?, error_code = ?, error_message = ?, finished_at = ?
      WHERE id = ?`,
      [
        requestId,
        request.response_payload ?? null,
        request.platform_status_code ?? null,
        request.status,
        request.error_code ?? null,
        request.error_message ?? null,
        request.finished_at ?? null,
        request.id,
      ],
    );
  }

  async findLatestByIdempotencyKey(
    accountId: string,
    endpointCode: string,
    idempotencyKey: string,
  ): Promise<ConnectorRequest | null> {
    return this.db.get<ConnectorRequest>(
      `SELECT
        id, workspace_id, request_id, account_id, credential_id, endpoint_code, idempotency_key,
        request_payload, response_payload, platform_status_code, status, error_code,
        error_message, started_at, finished_at
      FROM connector_requests
      WHERE account_id = ? AND endpoint_code = ? AND idempotency_key = ?
      ORDER BY started_at DESC
      LIMIT ?`,
      [accountId, endpointCode, idempotencyKey, 1],
    );
  }

  async listByWorkspaceId(workspaceId: string, limit: number, accountId?: string): Promise<ConnectorRequest[]> {
    if (accountId) {
      return this.db.all<ConnectorRequest>(
        `SELECT
          id, workspace_id, request_id, account_id, credential_id, endpoint_code, idempotency_key,
          request_payload, response_payload, platform_status_code, status, error_code,
          error_message, started_at, finished_at
        FROM connector_requests
        WHERE workspace_id = ? AND account_id = ?
        ORDER BY started_at DESC
        LIMIT ?`,
        [workspaceId, accountId, limit],
      );
    }

    return this.db.all<ConnectorRequest>(
      `SELECT
        id, workspace_id, request_id, account_id, credential_id, endpoint_code, idempotency_key,
        request_payload, response_payload, platform_status_code, status, error_code,
        error_message, started_at, finished_at
      FROM connector_requests
      WHERE workspace_id = ?
      ORDER BY started_at DESC
      LIMIT ?`,
      [workspaceId, limit],
    );
  }

  async listByRequestId(requestId: string): Promise<ConnectorRequest[]> {
    return this.db.all<ConnectorRequest>(
      `SELECT
        id, workspace_id, request_id, account_id, credential_id, endpoint_code, idempotency_key,
        request_payload, response_payload, platform_status_code, status, error_code,
        error_message, started_at, finished_at
      FROM connector_requests
      WHERE request_id = ?
      ORDER BY started_at ASC`,
      [requestId],
    );
  }
}
