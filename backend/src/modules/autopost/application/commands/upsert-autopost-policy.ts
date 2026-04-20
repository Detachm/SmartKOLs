import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { AccountsRepository } from "../../../accounts/application/ports/accounts-repository";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { WorkerJobsRepository } from "../../../execution/application/ports/worker-jobs-repository";
import { computeNextRecurringRunAfter } from "../../../editorial/domain/recurring-schedule";
import type { QueueAccountAutomationTick } from "../../../orchestration/application/commands/queue-account-automation-tick";
import type { AutopostPoliciesRepository } from "../ports/autopost-policies-repository";
import { createAutopostPolicy } from "../../domain/autopost-policy";
import { syncAutopostPolicyWorkerJob } from "../worker-job-sync";

export interface UpsertAutopostPolicyDependencies {
  accounts: AccountsRepository;
  policies: AutopostPoliciesRepository;
  workerJobs: WorkerJobsRepository;
  queueAccountAutomationTick: QueueAccountAutomationTick;
  auditLogs: AuditLogRepository;
  clock: Clock;
}

export class UpsertAutopostPolicy {
  constructor(private readonly deps: UpsertAutopostPolicyDependencies) {}

  async execute(input: {
    account_id: string;
    cadence_body: {
      timezone: string;
      weekday_codes: Array<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun">;
      slot_times: string[];
      min_spacing_minutes: number;
    };
    content_strategy_body: {
      generation_mode: "from_trend" | "from_source_scope";
      source_types: Array<"rss" | "website" | "twitter" | "youtube" | "substack" | "telegram">;
      max_source_age_days: number;
    };
    execution_body: {
      draft_review_mode: "manual" | "auto_approve";
      auto_queue_publish: boolean;
    };
    status: "active" | "paused";
  }) {
    const account = await this.deps.accounts.findById(input.account_id);
    if (!account) {
      throw new AppError("NOT_FOUND", "account not found", {
        details: { account_id: input.account_id },
      });
    }

    const existing = await this.deps.policies.findByAccountId(account.id);
    const now = this.deps.clock.now().toISOString();
    const policy = createAutopostPolicy({
      id: existing?.id ?? newId(),
      workspace_id: account.workspace_id,
      account_id: account.id,
      cadence_body: input.cadence_body,
      content_strategy_body: input.content_strategy_body,
      execution_body: input.execution_body,
      status: input.status,
      next_run_after: input.status === "active"
        ? computeNextRecurringRunAfter({
          cadence: input.cadence_body,
          now,
        })
        : undefined,
      last_attempted_at: existing?.last_attempted_at,
      last_run_status: existing?.last_run_status,
      last_failed_at: existing?.last_failed_at,
      last_error_code: existing?.last_error_code,
      last_error_message: existing?.last_error_message,
      last_enqueued_at: existing?.last_enqueued_at,
      last_run_id: existing?.last_run_id,
      updated_at: now,
    });

    await this.deps.policies.save(policy);
    await syncAutopostPolicyWorkerJob(this.deps.workerJobs, this.deps.clock, policy);
    await this.deps.auditLogs.append({
      id: newId(),
      workspace_id: policy.workspace_id,
      actor_type: "user",
      entity_type: "autopost_policy",
      entity_id: policy.id,
      action: existing ? "autopost_policy.updated" : "autopost_policy.created",
      before_state: existing ? JSON.stringify(existing) : undefined,
      after_state: JSON.stringify(policy),
      created_at: now,
    });
    if (policy.status === "active") {
      await this.deps.queueAccountAutomationTick.execute({
        account_id: policy.account_id,
        trigger_kind: "system",
        create_if_missing: true,
      });
    }

    return policy;
  }
}
