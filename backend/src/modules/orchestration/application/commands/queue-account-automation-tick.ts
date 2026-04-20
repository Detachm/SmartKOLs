import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { AccountsRepository } from "../../../accounts/application/ports/accounts-repository";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { WorkerJobsRepository } from "../../../execution/application/ports/worker-jobs-repository";
import { createWorkerJob } from "../../../execution/domain/worker-job";
import {
  createAccountOrchestrationState,
} from "../../domain/account-orchestration-state";
import type { OrchestrationRunTriggerKind } from "../../domain/orchestration-run";
import type { AccountOrchestrationStatesRepository } from "../ports/account-orchestration-states-repository";

export interface QueueAccountAutomationTickDependencies {
  accounts: AccountsRepository;
  states: AccountOrchestrationStatesRepository;
  workerJobs: WorkerJobsRepository;
  auditLogs: AuditLogRepository;
  clock: Clock;
}

export class QueueAccountAutomationTick {
  constructor(private readonly deps: QueueAccountAutomationTickDependencies) {}

  async execute(input: {
    account_id: string;
    trigger_kind: OrchestrationRunTriggerKind;
    run_after?: string;
    create_if_missing?: boolean;
  }) {
    const account = await this.deps.accounts.findById(input.account_id);
    if (!account) {
      throw new AppError("NOT_FOUND", "account not found", {
        details: { account_id: input.account_id },
      });
    }

    const now = this.deps.clock.now().toISOString();
    const runAfter = input.run_after?.trim() || now;
    const existing = await this.deps.states.findByAccountId(account.id);
    if (!existing && !input.create_if_missing) {
      return null;
    }
    const queuedJob = await this.deps.workerJobs.findQueuedByTypeAndTarget("orchestration.tick", "account", account.id);
    const effectiveRunAfter = shouldPreserveQueuedTick(queuedJob?.run_after, runAfter)
      ? queuedJob!.run_after
      : runAfter;

    const state = createAccountOrchestrationState({
      account_id: account.id,
      workspace_id: account.workspace_id,
      status: existing?.status ?? "active",
      next_tick_after: effectiveRunAfter,
      last_tick_at: existing?.last_tick_at,
      active_run_id: existing?.active_run_id,
      last_decision_type: existing?.last_decision_type,
      last_reason_code: existing?.last_reason_code,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    });

    await this.deps.states.save(state);
    if (state.status !== "active") {
      return null;
    }

    if (queuedJob && shouldPreserveQueuedTick(queuedJob.run_after, runAfter)) {
      return queuedJob;
    }

    await this.deps.workerJobs.cancelQueuedByTypeAndTarget("orchestration.tick", "account", account.id);

    const job = createWorkerJob({
      id: newId(),
      workspace_id: account.workspace_id,
      job_type: "orchestration.tick",
      target_type: "account",
      target_id: account.id,
      payload: JSON.stringify({
        account_id: account.id,
        trigger_kind: input.trigger_kind,
      }),
      run_after: runAfter,
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

function shouldPreserveQueuedTick(existingRunAfter: string | undefined, requestedRunAfter: string): boolean {
  return typeof existingRunAfter === "string" && existingRunAfter.trim() !== "" && existingRunAfter <= requestedRunAfter;
}
