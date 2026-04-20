import type { WorkerJob, WorkerJobStatus, WorkerJobType } from "../../domain/worker-job";

export interface WorkerJobsRepository {
  findById(jobId: string): Promise<WorkerJob | null>;
  findQueuedByTypeAndTarget(jobType: WorkerJobType, targetType: string, targetId: string): Promise<WorkerJob | null>;
  listByWorkspaceAndStatus(workspaceId: string, status: WorkerJobStatus, limit: number): Promise<WorkerJob[]>;
  create(job: WorkerJob): Promise<void>;
  save(job: WorkerJob): Promise<void>;
  cancelQueuedByTypeAndTarget(jobType: WorkerJobType, targetType: string, targetId: string): Promise<void>;
  claimNextReady(jobTypes: WorkerJobType[], now: string, startedAt: string, leaseExpiresAt: string): Promise<WorkerJob | null>;
  listExpiredRunning(now: string, limit: number, jobTypes?: WorkerJobType[]): Promise<WorkerJob[]>;
}
