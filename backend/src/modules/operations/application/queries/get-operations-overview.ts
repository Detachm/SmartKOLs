import type { Clock } from "../../../../core/time/clock";
import { requireIntegerInRange } from "../../../../core/validation/guards";
import type { OperationsOverviewResponse } from "../../../../contracts/api/operations";
import type { OperationsOverviewReadModel } from "../ports/operations-overview-read-model";
import {
  OPERATIONS_DEFAULT_EVENT_LIMIT,
  PROCESS_STALE_AFTER_MS,
  RECENT_CRITICAL_EVENT_WINDOW_MS,
} from "../../domain/operations-policy";

export interface GetOperationsOverviewDependencies {
  readModel: OperationsOverviewReadModel;
  clock: Clock;
}

export class GetOperationsOverview {
  constructor(private readonly deps: GetOperationsOverviewDependencies) {}

  async execute(limit = OPERATIONS_DEFAULT_EVENT_LIMIT): Promise<OperationsOverviewResponse> {
    return this.deps.readModel.getOverview({
      event_limit: requireIntegerInRange(limit, "limit", 1, 100),
      checked_at: this.deps.clock.now().toISOString(),
      stale_after_ms: PROCESS_STALE_AFTER_MS,
      recent_critical_event_window_ms: RECENT_CRITICAL_EVENT_WINDOW_MS,
    });
  }
}
