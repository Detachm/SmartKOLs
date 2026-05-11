import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { AccountsRepository } from "../../../accounts/application/ports/accounts-repository";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { WorkerJobsRepository } from "../ports/worker-jobs-repository";
import { createWorkerJob } from "../../domain/worker-job";

export interface QueuePullMentionsJobDependencies {
  accounts: AccountsRepository;
  workerJobs: WorkerJobsRepository;
  auditLogs: AuditLogRepository;
  clock: Clock;
}

export class QueuePullMentionsJob {
  constructor(private readonly deps: QueuePullMentionsJobDependencies) {}

  async execute(accountId: string) {
    const account = await this.deps.accounts.findById(accountId);
    if (!account) {
      throw new AppError("NOT_FOUND", "account not found", { details: { account_id: accountId } });
    }

    const now = this.deps.clock.now().toISOString();
    const existingQueued = await this.deps.workerJobs.findQueuedByTypeAndTarget("mentions.pull", "account", account.id);
    if (existingQueued) {
      return existingQueued;
    }

    const job = createWorkerJob({
      id: newId(),
      workspace_id: account.workspace_id,
      job_type: "mentions.pull",
      target_type: "account",
      target_id: account.id,
      payload: JSON.stringify({ account_id: account.id }),
      run_after: now,
      created_at: now,
    });
    await this.deps.workerJobs.create(job);
    await this.deps.auditLogs.append({
      id: newId(),
      workspace_id: account.workspace_id,
      actor_type: "system",
      entity_type: "worker_job",
      entity_id: job.id,
      action: "worker_job.queued",
      after_state: JSON.stringify(job),
      created_at: now,
    });
    return job;
  }
}
