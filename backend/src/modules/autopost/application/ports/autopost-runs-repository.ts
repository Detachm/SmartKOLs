import type { AutopostRun } from "../../domain/autopost-run";

export interface AutopostRunsRepository {
  findById(runId: string): Promise<AutopostRun | null>;
  findActiveByPolicyId(policyId: string): Promise<AutopostRun | null>;
  findActiveByTaskId(taskId: string): Promise<AutopostRun | null>;
  listByAccountId(accountId: string, limit: number): Promise<AutopostRun[]>;
  save(run: AutopostRun): Promise<void>;
}
