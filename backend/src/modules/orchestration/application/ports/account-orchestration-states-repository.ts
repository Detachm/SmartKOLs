import type { AccountOrchestrationState } from "../../domain/account-orchestration-state";

export interface AccountOrchestrationStatesRepository {
  findByAccountId(accountId: string): Promise<AccountOrchestrationState | null>;
  save(state: AccountOrchestrationState): Promise<void>;
}
