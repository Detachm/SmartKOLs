import type { RiskEvent } from "../../domain/risk-event";

export interface RiskEventsRepository {
  create(event: RiskEvent): Promise<void>;
  listByWorkspaceId(workspaceId: string, limit: number): Promise<RiskEvent[]>;
}
