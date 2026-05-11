import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { AccountsRepository } from "../../../accounts/application/ports/accounts-repository";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { AlertsRepository } from "../../../monitoring/application/ports/alerts-repository";
import { createAlert } from "../../../monitoring/domain/alert";
import type { QueueAccountAutomationTick } from "./queue-account-automation-tick";
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
import { resolveNextAccountAutomationTickAfter } from "../reconcile-account-automation-tick-worker-jobs";

export interface TickAccountAutomationDependencies {
  accounts: AccountsRepository;
  states: AccountOrchestrationStatesRepository;
  runs: OrchestrationRunsRepository;
  overviews: AccountAutomationOverviewReadModel;
  eligibility: EvaluateAccountEligibility;
  chief: ChiefOrchestrator;
  applier: ApplyOrchestrationDecision;
  queueAccountAutomationTick: QueueAccountAutomationTick;
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
      let applied;
      try {
        applied = await this.deps.applier.execute(decision);
      } catch (error) {
        const appError = error instanceof AppError
          ? error
          : new AppError("EXTERNAL_DEPENDENCY_ERROR", "orchestration decision execution failed", { cause: error });
        if (isIsolatedEngagementDecision(decision.type)) {
          return this.handleIsolatedDecisionFailure({
            account,
            run,
            state: runningState,
            evaluation,
            decision,
            error: appError,
          });
        }
        throw appError;
      }
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
        next_tick_after: resolveNextAccountAutomationTickAfter(finishedAt),
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
        next_tick_after: resolveNextAccountAutomationTickAfter(finishedAt),
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

  private async handleIsolatedDecisionFailure(input: {
    account: {
      id: string;
      workspace_id: string;
    };
    run: ReturnType<typeof createOrchestrationRun>;
    state: ReturnType<typeof markAccountOrchestrationTickStarted>;
    evaluation: ReturnType<EvaluateAccountEligibility["execute"]>;
    decision: ReturnType<ChiefOrchestrator["decide"]>;
    error: AppError;
  }) {
    const finishedAt = this.deps.clock.now().toISOString();
    const retryAfter = resolveIsolatedRetryAfter(input.error.code, finishedAt);
    await this.deps.runs.save(failOrchestrationRun(input.run, {
      eligible_actions_json: JSON.stringify(input.evaluation.eligible_actions),
      chosen_action_json: JSON.stringify(input.decision),
      error_code: input.error.code,
      error_message: input.error.message,
      finished_at: finishedAt,
    }));
    await this.deps.states.save(completeAccountOrchestrationTick(input.state, {
      last_tick_at: finishedAt,
      last_decision_type: input.decision.type,
      last_reason_code: undefined,
      next_tick_after: retryAfter,
      updated_at: finishedAt,
    }));
    if (retryAfter) {
      await this.deps.queueAccountAutomationTick.execute({
        account_id: input.account.id,
        trigger_kind: "system",
        create_if_missing: true,
        run_after: retryAfter,
      });
    }
    await this.deps.alerts.create(createAlert({
      id: newId(),
      workspace_id: input.account.workspace_id,
      severity: "warning",
      source_type: "runtime",
      source_id: input.run.id,
      code: "orchestration.run.action_failed",
      message: input.error.message,
      payload: JSON.stringify({
        account_id: input.account.id,
        error_code: input.error.code,
        chosen_action_type: input.decision.type,
        isolated: true,
        retry_after: retryAfter,
      }),
      created_at: finishedAt,
    }));
    await this.deps.auditLogs.append({
      id: newId(),
      workspace_id: input.account.workspace_id,
      actor_type: "system",
      entity_type: "orchestration_run",
      entity_id: input.run.id,
      action: "orchestration_run.failed_isolated",
      after_state: JSON.stringify({
        run: {
          ...input.run,
          status: "failed",
          chosen_action_json: JSON.stringify(input.decision),
          eligible_actions_json: JSON.stringify(input.evaluation.eligible_actions),
          error_code: input.error.code,
          error_message: input.error.message,
          finished_at: finishedAt,
        },
        retry_after: retryAfter,
      }),
      created_at: finishedAt,
    });

    return {
      account_id: input.account.id,
      run_id: input.run.id,
      decision: input.decision,
      isolated_failure: {
        error_code: input.error.code,
        error_message: input.error.message,
        retry_after: retryAfter,
      },
    };
  }
}

function isIsolatedEngagementDecision(decisionType: string) {
  return decisionType.startsWith("engagement.");
}

function resolveIsolatedRetryAfter(errorCode: AppError["code"], finishedAt: string) {
  const delayMinutes = (() => {
    switch (errorCode) {
      case "MODEL_RATE_LIMITED":
      case "SOURCE_FETCH_RATE_LIMITED":
        return 30;
      case "MODEL_TIMEOUT":
      case "MODEL_UPSTREAM_5XX":
      case "MODEL_NETWORK_ERROR":
      case "EXTERNAL_DEPENDENCY_ERROR":
        return 15;
      default:
        return undefined;
    }
  })();

  if (!delayMinutes) {
    return undefined;
  }

  return new Date(Date.parse(finishedAt) + delayMinutes * 60_000).toISOString();
}
