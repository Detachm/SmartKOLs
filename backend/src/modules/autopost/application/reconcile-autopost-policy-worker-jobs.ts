import type { Clock } from "../../../core/time/clock";
import type { WorkerJobsRepository } from "../../execution/application/ports/worker-jobs-repository";
import type { AutopostPoliciesRepository } from "./ports/autopost-policies-repository";
import { syncAutopostPolicyWorkerJob } from "./worker-job-sync";

export async function reconcileAutopostPolicyWorkerJobs(input: {
  policies: AutopostPoliciesRepository;
  workerJobs: WorkerJobsRepository;
  clock: Clock;
}) {
  const policies = await input.policies.listActiveScheduled();
  for (const policy of policies) {
    await syncAutopostPolicyWorkerJob(input.workerJobs, input.clock, policy);
  }
}
