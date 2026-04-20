import type { Alert } from "../../domain/alert";

export interface AlertsRepository {
  create(alert: Alert): Promise<void>;
  listByWorkspaceId(workspaceId: string, limit: number): Promise<Alert[]>;
  listByRequestId(requestId: string): Promise<Alert[]>;
}
