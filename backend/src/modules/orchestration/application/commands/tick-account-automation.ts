import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { AccountsRepository } from "../../../accounts/application/ports/accounts-repository";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { AlertsRepository } from "../../../monitoring/application/ports/alerts-repository";
import { createAlert } from "../../../monitoring/domain/alert";
import {
  completeAccountOrchestrationTick,
  createAccountOrchestrationState,
  markAccountOrchestrationTickStarted,
} from "../../domain/account-orchestration-state";
import { failOrchestrationRun, createOrchestrationRun, succeedOrchestrationRun, type OrchestrationRunTriggerKind } from "../../domain/orchestration-run";
import type { AccountOrchestrationStatesRepository } from "../ports/account-orchestration-states-repository";
import type { OrchestrationRunsRepository } from "../ports/orchestration-runs-repository";
import type { AccountAutomationOverviewReadModel } from "../ports/account-automation-overview-read-model";
import { EvaluateAccountEligibility } from "../services/evaluate-account-eligibility";
import { ChiefOrchestrator } from "../services/chief-orchestrator";
import { ApplyOrchestrationDecision } from "../services/apply-orchestration-decision";

export interface TickAccountAutomationDependencies {
  accounts: AccountsRepository;
  states: AccountOrchestrationStatesRepository;
  runs: OrchestrationRunsRepository;
  overviews: AccountAutomationOverviewReadModel;
  eligibility: EvaluateAccountEligibility;
  chief: ChiefOrchestrator;
  applier: ApplyOrchestrationDecision;
  alerts: AlertsRepository;
  auditLogs: AuditLogRepository;
  clock: Clock;
}

export class TickAccountAutomation {
  constructor(private readonly deps: TickAccountAutomationDependencies) {}

  async execute(input: {
    account_id: string;
    trigger_kind: OrchestrationRunTriggerKind;
  }) {
    const account = await this.deps.accounts.findById(input.account_id);
    if (!account) {
      throw new AppError("NOT_FOUND", "account not found", {
        details: { account_id: input.account_id },
      });
    }

    const now = this.deps.clock.now().toISOString();
    const existingState = await this.deps.states.findByAccountId(account.id);
    const state = existingState ?? createAccountOrchestrationState({
      account_id: account.id,
      workspace_id: account.workspace_id,
      status: "active",
      created_at: now,
      updated_at: now,
    });
    if (state.status !== "active") {
      return {
        account_id: account.id,
        status: "paused" as const,
      };
    }

    const run = createOrchestrationRun({
      id: newId(),
      workspace_id: account.workspace_id,
      account_id: account.id,
      trigger_kind: input.trigger_kind,
      eligible_actions_json: "[]",
      created_at: now,
    });
    const runningState = markAccountOrchestrationTickStarted(state, {
      run_id: run.id,
      updated_at: now,
    });
    await this.deps.states.save(runningState);
    await this.deps.runs.create(run);

    try {
      const overview = await this.deps.overviews.getAccountAutomationOverview(account.id);
      if (!overview) {
        throw new AppError("NOT_FOUND", "account automation overview not found", {
          details: { account_id: account.id },
        });
      }

      const evaluation = this.deps.eligibility.execute(overview, now);
      const decision = this.deps.chief.decide({
        account_id: account.id,
        eligible_actions: evaluation.eligible_actions,
        blocked_reason_code: evaluation.blocked_reason_code,
        rationale: evaluation.rationale,
      });
      const applied = await this.deps.applier.execute(decision);
      const finishedAt = this.deps.clock.now().toISOString();

      await this.deps.runs.save(succeedOrchestrationRun(run, {
        eligible_actions_json: JSON.stringify(evaluation.eligible_actions),
        chosen_action_json: JSON.stringify(applied),
        finished_at: finishedAt,
      }));
      const nextState = completeAccountOrchestrationTick(runningState, {
        last_tick_at: finishedAt,
        last_decision_type: decision.type,
        last_reason_code: decision.type === "no_action" ? decision.reason_code : undefined,
        updated_at: finishedAt,
      });
      await this.deps.states.save(nextState);
      await this.deps.auditLogs.append({
        id: newId(),
        workspace_id: account.workspace_id,
        actor_type: "system",
        entity_type: "orchestration_run",
        entity_id: run.id,
        action: "orchestration_run.succeeded",
        after_state: JSON.stringify({
          run: {
            ...run,
            status: "succeeded",
            chosen_action_json: JSON.stringify(applied),
            eligible_actions_json: JSON.stringify(evaluation.eligible_actions),
            finished_at: finishedAt,
          },
          decision,
        }),
        created_at: finishedAt,
      });

      return {
        account_id: account.id,
        run_id: run.id,
        decision,
      };
    } catch (error) {
      const appError = error instanceof AppError
        ? error
        : new AppError("EXTERNAL_DEPENDENCY_ERROR", "account orchestration tick failed", { cause: error });
      const finishedAt = this.deps.clock.now().toISOString();
      await this.deps.runs.save(failOrchestrationRun(run, {
        error_code: appError.code,
        error_message: appError.message,
        finished_at: finishedAt,
      }));
      await this.deps.states.save(completeAccountOrchestrationTick(runningState, {
        last_tick_at: finishedAt,
        last_decision_type: "no_action",
        last_reason_code: "tick_failed",
        updated_at: finishedAt,
      }));
      await this.deps.alerts.create(createAlert({
        id: newId(),
        workspace_id: account.workspace_id,
        severity: "warning",
        source_type: "runtime",
        source_id: run.id,
        code: "orchestration.run.failed",
        message: appError.message,
        payload: JSON.stringify({
          account_id: account.id,
          error_code: appError.code,
        }),
        created_at: finishedAt,
      }));
      await this.deps.auditLogs.append({
        id: newId(),
        workspace_id: account.workspace_id,
        actor_type: "system",
        entity_type: "orchestration_run",
        entity_id: run.id,
        action: "orchestration_run.failed",
        after_state: JSON.stringify({
          run: {
            ...run,
            status: "failed",
            error_code: appError.code,
            error_message: appError.message,
            finished_at: finishedAt,
          },
        }),
        created_at: finishedAt,
      });
      throw appError;
    }
  }
}
