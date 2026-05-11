import type { AccountOrchestrationState } from "../../domain/account-orchestration-state";

export interface AccountAutomationTickCandidate {
  account_id: string;
  workspace_id: string;
  status?: "active" | "paused";
  next_tick_after?: string;
  last_tick_at?: string;
  active_run_id?: string;
}

export interface AccountOrchestrationStatesRepository {
  findByAccountId(accountId: string): Promise<AccountOrchestrationState | null>;
  listDueAutomationTickCandidates(input: {
    now: string;
    stale_before: string;
    limit: number;
  }): Promise<AccountAutomationTickCandidate[]>;
  save(state: AccountOrchestrationState): Promise<void>;
}
