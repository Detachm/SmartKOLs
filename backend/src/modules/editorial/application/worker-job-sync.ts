import { newId } from "../../../core/ids/new-id";
import type { Clock } from "../../../core/time/clock";
import type { WorkerJobsRepository } from "../../execution/application/ports/worker-jobs-repository";
import { createWorkerJob } from "../../execution/domain/worker-job";
import type { RecurringBriefPlan } from "../domain/editorial";

export async function syncRecurringBriefPlanWorkerJob(
  workerJobs: WorkerJobsRepository,
  clock: Clock,
  plan: RecurringBriefPlan,
) {
  await workerJobs.cancelQueuedByTypeAndTarget("editorial.recurring_brief.execute", "recurring_brief_plan", plan.id);

  if (plan.status !== "active" || !plan.next_run_after) {
    return;
  }

  try {
    await workerJobs.create(createWorkerJob({
      id: newId(),
      workspace_id: plan.workspace_id,
      job_type: "editorial.recurring_brief.execute",
      target_type: "recurring_brief_plan",
      target_id: plan.id,
      payload: JSON.stringify({
        plan_id: plan.id,
        account_id: plan.account_id,
      }),
      run_after: plan.next_run_after,
      created_at: clock.now().toISOString(),
    }));
  } catch (error) {
    if (isQueuedEditorialJobDuplicate(error)) {
      return;
    }

    throw error;
  }
}

function isQueuedEditorialJobDuplicate(error: unknown) {
  return error instanceof Error
    && (
      error.message.includes("idx_worker_jobs_editorial_queued_target")
      || error.message.includes("UNIQUE constraint failed: worker_jobs.job_type, worker_jobs.target_type, worker_jobs.target_id")
    );
}
