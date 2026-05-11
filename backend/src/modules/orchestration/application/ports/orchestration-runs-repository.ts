import type { OrchestrationRun } from "../../domain/orchestration-run";

export interface OrchestrationRunsRepository {
  findById(runId: string): Promise<OrchestrationRun | null>;
  listRecentByAccountId(accountId: string, limit: number): Promise<OrchestrationRun[]>;
  create(run: OrchestrationRun): Promise<void>;
  save(run: OrchestrationRun): Promise<void>;
}
