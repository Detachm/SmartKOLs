import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { WorkerJobsRepository } from "../../../execution/application/ports/worker-jobs-repository";
import type { RecurringBriefPlansRepository } from "../ports/recurring-brief-plans-repository";

export interface RemoveRecurringBriefPlanDependencies {
  plans: RecurringBriefPlansRepository;
  workerJobs: WorkerJobsRepository;
  auditLogs: AuditLogRepository;
  clock: Clock;
}

export class RemoveRecurringBriefPlan {
  constructor(private readonly deps: RemoveRecurringBriefPlanDependencies) {}

  async execute(planId: string) {
    const plan = await this.deps.plans.findById(planId);
    if (!plan) {
      throw new AppError("NOT_FOUND", "recurring brief plan not found", {
        details: { plan_id: planId },
      });
    }

    await this.deps.workerJobs.cancelQueuedByTypeAndTarget("editorial.recurring_brief.execute", "recurring_brief_plan", plan.id);
    await this.deps.plans.delete(plan.id);
    await this.deps.auditLogs.append({
      id: newId(),
      workspace_id: plan.workspace_id,
      actor_type: "user",
      entity_type: "recurring_brief_plan",
      entity_id: plan.id,
      action: "recurring_brief_plan.deleted",
      before_state: JSON.stringify(plan),
      created_at: this.deps.clock.now().toISOString(),
    });
  }
}
