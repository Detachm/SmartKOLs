import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { WorkerJobsRepository } from "../../../execution/application/ports/worker-jobs-repository";
import type { RecurringBriefPlansRepository } from "../ports/recurring-brief-plans-repository";
import { createRecurringBriefPlan } from "../../domain/editorial";
import { computeNextRecurringRunAfter } from "../../domain/recurring-schedule";
import { syncRecurringBriefPlanWorkerJob } from "../worker-job-sync";

export interface FailRecurringBriefPlanExecutionDependencies {
  plans: RecurringBriefPlansRepository;
  workerJobs: WorkerJobsRepository;
  auditLogs: AuditLogRepository;
  clock: Clock;
}

export class FailRecurringBriefPlanExecution {
  constructor(private readonly deps: FailRecurringBriefPlanExecutionDependencies) {}

  async execute(planId: string, errorCode: string, errorMessage: string) {
    const plan = await this.deps.plans.findById(planId);
    if (!plan || plan.status !== "active") {
      return;
    }

    const now = this.deps.clock.now().toISOString();
    const nextPlan = createRecurringBriefPlan({
      ...plan,
      next_run_after: computeNextRecurringRunAfter({
        cadence: plan.cadence_body,
        now,
        not_before: new Date(Date.parse(now) + plan.cadence_body.min_spacing_minutes * 60_000).toISOString(),
      }),
      last_attempted_at: now,
      last_run_status: "failed",
      last_failed_at: now,
      last_error_code: errorCode,
      last_error_message: errorMessage,
      updated_at: now,
    });

    await this.deps.plans.save(nextPlan);
    await syncRecurringBriefPlanWorkerJob(this.deps.workerJobs, this.deps.clock, nextPlan);
    await this.deps.auditLogs.append({
      id: newId(),
      workspace_id: nextPlan.workspace_id,
      actor_type: "system",
      entity_type: "recurring_brief_plan",
      entity_id: nextPlan.id,
      action: "recurring_brief_plan.failed",
      before_state: JSON.stringify(plan),
      after_state: JSON.stringify(nextPlan),
      created_at: now,
    });
  }
}
