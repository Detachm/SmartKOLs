import type { PublishSchedule } from "../../domain/publish-schedule";
import type { PublishJob, PublishJobStatus } from "../../domain/publish-job";

export interface SchedulesRepository {
  findScheduleById(scheduleId: string): Promise<PublishSchedule | null>;
  listDueScheduledSchedules(now: string, limit: number): Promise<PublishSchedule[]>;
  createSchedule(schedule: PublishSchedule): Promise<void>;
  saveSchedule(schedule: PublishSchedule): Promise<void>;
  createPublishJob(job: PublishJob): Promise<void>;
  findPublishJobById(publishJobId: string): Promise<PublishJob | null>;
  findLatestPublishJobByScheduleId(scheduleId: string): Promise<PublishJob | null>;
  listPublishJobsByWorkspaceAndStatus(workspaceId: string, status: PublishJobStatus, limit: number): Promise<PublishJob[]>;
  claimNextReadyPublishJob(now: string, startedAt: string, leaseExpiresAt: string): Promise<PublishJob | null>;
  listExpiredRunningPublishJobs(now: string, limit: number): Promise<PublishJob[]>;
  savePublishJob(job: PublishJob): Promise<void>;
}
