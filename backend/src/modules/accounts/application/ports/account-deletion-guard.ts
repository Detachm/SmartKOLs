export interface AccountDeleteSafetyCheck {
  active_agent_tasks: number;
  active_worker_jobs: number;
  active_publish_jobs: number;
  active_source_fetch_runs: number;
}

export interface AccountDeletionGuard {
  getDeleteSafety(accountId: string): Promise<AccountDeleteSafetyCheck>;
}
