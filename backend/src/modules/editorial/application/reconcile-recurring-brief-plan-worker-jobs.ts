import type { Clock } from "../../../core/time/clock";
import type { WorkerJobsRepository } from "../../execution/application/ports/worker-jobs-repository";
import type { RecurringBriefPlansRepository } from "./ports/recurring-brief-plans-repository";
import { syncRecurringBriefPlanWorkerJob } from "./worker-job-sync";

export async function reconcileRecurringBriefPlanWorkerJobs(input: {
  plans: RecurringBriefPlansRepository;
  workerJobs: WorkerJobsRepository;
  clock: Clock;
}) {
  const plans = await input.plans.listActiveScheduled();
  for (const plan of plans) {
    await syncRecurringBriefPlanWorkerJob(input.workerJobs, input.clock, plan);
  }
}
