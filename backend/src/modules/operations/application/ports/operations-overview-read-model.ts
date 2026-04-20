import type { OperationsOverviewResponse } from "../../../../contracts/api/operations";

export interface OperationsOverviewReadModel {
  getOverview(input: {
    event_limit: number;
    checked_at: string;
    stale_after_ms: number;
    recent_critical_event_window_ms: number;
  }): Promise<OperationsOverviewResponse>;
}
