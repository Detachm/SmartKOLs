import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { AccountsRepository } from "../../../accounts/application/ports/accounts-repository";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import { createAccountOrchestrationState, resumeAccountOrchestration } from "../../domain/account-orchestration-state";
import type { AccountOrchestrationStatesRepository } from "../ports/account-orchestration-states-repository";
import type { QueueAccountAutomationTick } from "./queue-account-automation-tick";

export interface ResumeAccountAutomationDependencies {
  accounts: AccountsRepository;
  states: AccountOrchestrationStatesRepository;
  auditLogs: AuditLogRepository;
  queueAccountAutomationTick: QueueAccountAutomationTick;
  clock: Clock;
}

export class ResumeAccountAutomation {
  constructor(private readonly deps: ResumeAccountAutomationDependencies) {}

  async execute(accountId: string) {
    const account = await this.deps.accounts.findById(accountId);
    if (!account) {
      throw new AppError("NOT_FOUND", "account not found", {
        details: { account_id: accountId },
      });
    }

    const now = this.deps.clock.now().toISOString();
    const existing = await this.deps.states.findByAccountId(account.id);
    const current = existing ?? createAccountOrchestrationState({
      account_id: account.id,
      workspace_id: account.workspace_id,
      status: "paused",
      created_at: now,
      updated_at: now,
    });
    const next = resumeAccountOrchestration(current, { updated_at: now });
    await this.deps.states.save(next);
    await this.deps.auditLogs.append({
      id: newId(),
      workspace_id: account.workspace_id,
      actor_type: "user",
      entity_type: "account_orchestration_state",
      entity_id: account.id,
      action: "account_automation.resumed",
      before_state: JSON.stringify(current),
      after_state: JSON.stringify(next),
      created_at: now,
    });
    await this.deps.queueAccountAutomationTick.execute({
      account_id: account.id,
      trigger_kind: "manual",
      create_if_missing: true,
    });
    return next;
  }
}
