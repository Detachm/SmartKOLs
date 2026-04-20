import type { ConnectorRequest } from "../../domain/connector-request";

export interface ConnectorRequestRepository {
  create(request: ConnectorRequest): Promise<void>;
  save(request: ConnectorRequest): Promise<void>;
  findLatestByIdempotencyKey(
    accountId: string,
    endpointCode: string,
    idempotencyKey: string,
  ): Promise<ConnectorRequest | null>;
  listByWorkspaceId(workspaceId: string, limit: number, accountId?: string): Promise<ConnectorRequest[]>;
  listByRequestId(requestId: string): Promise<ConnectorRequest[]>;
}
