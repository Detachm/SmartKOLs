import type { Clock } from "../../../../core/time/clock";
import type { OperationsHealthResponse } from "../../../../contracts/api/operations";
import type { GetOperationsOverview } from "./get-operations-overview";

export interface GetOperationsHealthDependencies {
  overview: GetOperationsOverview;
  clock: Clock;
}

export class GetOperationsHealth {
  constructor(private readonly deps: GetOperationsHealthDependencies) {}

  async execute(): Promise<OperationsHealthResponse> {
    const overview = await this.deps.overview.execute(20);
    return {
      checked_at: this.deps.clock.now().toISOString(),
      health_status: overview.summary.health_status,
      reasons: overview.summary.reasons,
      active_http_servers: overview.summary.active_http_servers,
      active_workers: overview.summary.active_workers,
      stale_processes: overview.summary.stale_processes,
      failed_jobs: overview.summary.failed_jobs,
    };
  }
}
