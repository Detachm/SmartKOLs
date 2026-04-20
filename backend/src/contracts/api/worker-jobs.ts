import type { WorkerJob } from "../../modules/execution/domain/worker-job";

export interface WorkerJobResponse {
  job_id: string;
  status: WorkerJob["status"];
}

export interface WorkerJobDetailResponse {
  job: WorkerJob;
}
