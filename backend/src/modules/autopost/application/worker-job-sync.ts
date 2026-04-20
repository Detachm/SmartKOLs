import { newId } from "../../../core/ids/new-id";
import type { Clock } from "../../../core/time/clock";
import type { WorkerJobsRepository } from "../../execution/application/ports/worker-jobs-repository";
import { createWorkerJob } from "../../execution/domain/worker-job";
import type { AutopostPolicy } from "../domain/autopost-policy";

export async function syncAutopostPolicyWorkerJob(
  workerJobs: WorkerJobsRepository,
  clock: Clock,
  policy: AutopostPolicy,
) {
  await workerJobs.cancelQueuedByTypeAndTarget("autopost.execute", "autopost_policy", policy.id);

  if (policy.status !== "active" || !policy.next_run_after) {
    return;
  }

  try {
    await workerJobs.create(createWorkerJob({
      id: newId(),
      workspace_id: policy.workspace_id,
      job_type: "autopost.execute",
      target_type: "autopost_policy",
      target_id: policy.id,
      payload: JSON.stringify({
        policy_id: policy.id,
        account_id: policy.account_id,
      }),
      run_after: policy.next_run_after,
      created_at: clock.now().toISOString(),
    }));
  } catch (error) {
    if (isQueuedAutopostJobDuplicate(error)) {
      return;
    }

    throw error;
  }
}

function isQueuedAutopostJobDuplicate(error: unknown) {
  return error instanceof Error
    && (
      error.message.includes("idx_worker_jobs_autopost_queued_target")
      || error.message.includes("UNIQUE constraint failed: worker_jobs.job_type, worker_jobs.target_type, worker_jobs.target_id")
    );
}
