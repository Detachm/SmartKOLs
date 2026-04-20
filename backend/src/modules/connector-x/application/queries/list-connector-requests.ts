import type { ConnectorRequestRepository } from "../ports/connector-request-repository";

export interface ListConnectorRequestsDependencies {
  connectorRequests: ConnectorRequestRepository;
}

export class ListConnectorRequests {
  constructor(private readonly deps: ListConnectorRequestsDependencies) {}

  async execute(workspaceId: string, limit: number, accountId?: string) {
    return {
      items: await this.deps.connectorRequests.listByWorkspaceId(workspaceId, limit, accountId),
    };
  }
}
