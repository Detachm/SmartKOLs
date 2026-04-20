import { newId } from "../../core/ids/new-id";
import { systemClock } from "../../core/time/clock";
import { buildAppContext, type BuildAppContextOptions } from "./build-app-context";
import type { AgentTaskExecuteJob, AgentTaskJobType } from "../../contracts/jobs/agent-task-execute";
import type { PublishExecuteJob } from "../../contracts/jobs/publish-execute";
import type { SourceFetchJob } from "../../contracts/jobs/source-fetch";
import { SqliteAgentRuntimeRepository } from "../../modules/agent-runtime/infrastructure/sqlite-agent-runtime-repository";
import { SqliteSchedulesRepository } from "../../modules/schedules/infrastructure/sqlite-schedules-repository";
import { SqliteSourcesRepository } from "../../modules/sources/infrastructure/sqlite-sources-repository";
import { SqliteWorkerJobsRepository } from "../../modules/execution/infrastructure/sqlite-worker-jobs-repository";
import type { WorkerJobType } from "../../modules/execution/domain/worker-job";
import { PROCESS_HEARTBEAT_INTERVAL_MS, PROCESS_STALE_AFTER_MS } from "../../modules/operations/domain/operations-policy";
import { SqliteRuntimeProcessesRepository } from "../../modules/operations/infrastructure/sqlite-runtime-processes-repository";
import { SqliteRuntimeEventsRepository } from "../../modules/operations/infrastructure/sqlite-runtime-events-repository";
import { StructuredLogger } from "../../modules/operations/infrastructure/structured-logger";
import { createRuntimeProcessSupervisor } from "../../modules/operations/infrastructure/runtime-process-supervisor";
import { SqliteRecurringBriefPlansRepository } from "../../modules/editorial/infrastructure/sqlite-recurring-brief-plans-repository";
import { reconcileRecurringBriefPlanWorkerJobs } from "../../modules/editorial/application/reconcile-recurring-brief-plan-worker-jobs";
import { SqliteAutopostPoliciesRepository } from "../../modules/autopost/infrastructure/sqlite-autopost-policies-repository";
import { reconcileAutopostPolicyWorkerJobs } from "../../modules/autopost/application/reconcile-autopost-policy-worker-jobs";

export type WorkerName = "all" | "agent-worker" | "publisher-worker" | "ingestion-worker" | "engagement-worker" | "editorial-worker";

export interface WorkerRunnerConfig extends BuildAppContextOptions {
  worker_name: WorkerName;
  poll_interval_ms: number;
  max_jobs_per_tick: number;
}

interface WorkerDispatcher<TJob> {
  name: string;
  claim(): Promise<TJob | null>;
  execute(job: TJob): Promise<void>;
}

const SUPPORTED_AGENT_TASK_TYPES = new Set<AgentTaskJobType>([
  "content_brief.generate",
  "draft.generate",
  "draft.review",
  "inbox.classify",
  "engagement.reply_propose",
  "persona.distill",
]);

const ENGAGEMENT_WORKER_JOB_TYPES: WorkerJobType[] = [
  "mentions.pull",
  "dm.pull",
  "engagement.reply.execute",
];

const EDITORIAL_WORKER_JOB_TYPES: WorkerJobType[] = [
  "editorial.recurring_brief.execute",
  "autopost.execute",
  "orchestration.tick",
];

export async function createWorkerRunner(config: WorkerRunnerConfig) {
  const context = await buildAppContext(config);
  const runtime = new SqliteAgentRuntimeRepository(context.sqlite.db, context.requestContext);
  const schedules = new SqliteSchedulesRepository(context.sqlite.db);
  const sources = new SqliteSourcesRepository(context.sqlite.db);
  const workerJobs = new SqliteWorkerJobsRepository(context.sqlite.db);
  const recurringBriefPlans = new SqliteRecurringBriefPlansRepository(context.sqlite.db);
  const autopostPolicies = new SqliteAutopostPoliciesRepository(context.sqlite.db);
  const runtimeProcesses = new SqliteRuntimeProcessesRepository(context.sqlite.db);
  const runtimeEvents = new SqliteRuntimeEventsRepository(context.sqlite.db);
  const logger = new StructuredLogger({
    events: runtimeEvents,
    requestContext: context.requestContext,
    clock: systemClock,
  });
  const supervisor = createRuntimeProcessSupervisor({
    process_type: "worker",
    process_name: config.worker_name,
    metadata: {
      poll_interval_ms: config.poll_interval_ms,
      max_jobs_per_tick: config.max_jobs_per_tick,
    },
    heartbeat_interval_ms: PROCESS_HEARTBEAT_INTERVAL_MS,
    clock: systemClock,
    processes: runtimeProcesses,
    logger,
  });
  const dispatchers = createDispatchers(config.worker_name, {
    runtime,
    schedules,
    sources,
    workerJobs,
    context,
  });

  let timer: NodeJS.Timeout | null = null;
  let tickInFlight = false;
  let nextDispatcherIndex = 0;

  return {
    async start() {
      if (timer) {
        throw new Error("worker runner is already started");
      }

      const cleanupCutoff = new Date(Date.now() - PROCESS_STALE_AFTER_MS).toISOString();
      await runtimeProcesses.cleanupStaleRunningProcesses({
        stale_before: cleanupCutoff,
        stopped_at: new Date().toISOString(),
        limit: 500,
      });
      await supervisor.start();
      if (config.worker_name === "all" || config.worker_name === "editorial-worker") {
        await reconcileRecurringBriefPlanWorkerJobs({
          plans: recurringBriefPlans,
          workerJobs,
          clock: systemClock,
        });
        await reconcileAutopostPolicyWorkerJobs({
          policies: autopostPolicies,
          workerJobs,
          clock: systemClock,
        });
      }
      void drainOnce();
      timer = setInterval(() => {
        void drainOnce();
      }, config.poll_interval_ms);
    },
    async drainOnce() {
      return drainOnce();
    },
    async close() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      await supervisor.stop();
      context.sqlite.db.close();
    },
  };

  async function drainOnce(): Promise<number> {
    if (tickInFlight) {
      return 0;
    }

    tickInFlight = true;
    try {
      await recoverExpiredLeases();

      let processed = 0;
      while (processed < config.max_jobs_per_tick) {
        const dispatcher = await claimNextDispatcher();
        if (!dispatcher) {
          break;
        }

        processed += 1;
        await context.requestContext.run({ request_id: newId() }, async () => {
          try {
            await dispatcher.dispatcher.execute(dispatcher.job);
          } catch (error) {
            await logger.emit({
              process_id: supervisor.process_id,
              severity: "critical",
              event_type: "worker.job.failed",
              source_type: "worker",
              source_id: supervisor.process_id,
              message: `[worker:${dispatcher.dispatcher.name}] job execution failed`,
              payload: {
                worker_name: config.worker_name,
                dispatcher: dispatcher.dispatcher.name,
                job: summarizeJob(dispatcher.job),
                error: error instanceof Error ? error.message : "unknown worker execution error",
              },
            });
          }
        });
      }

      return processed;
    } finally {
      tickInFlight = false;
    }
  }

  async function recoverExpiredLeases() {
    const now = new Date().toISOString();
    const recoveryLimit = config.max_jobs_per_tick;

    if (config.worker_name === "all" || config.worker_name === "agent-worker") {
      const staleTasks = await runtime.listExpiredRunningTasks(now, recoveryLimit);
      if (staleTasks.length > 0) {
        await logger.emit({
          process_id: supervisor.process_id,
          severity: "warning",
          event_type: "worker.recovered_expired_agent_tasks",
          source_type: "worker",
          source_id: supervisor.process_id,
          message: `Recovered ${staleTasks.length} expired agent task leases`,
          payload: {
            worker_name: config.worker_name,
            task_ids: staleTasks.map((task) => task.id),
          },
        });
      }
      for (const task of staleTasks) {
        await context.requestContext.run({ request_id: newId() }, async () => {
          await context.commands.expireAgentTaskLease.execute(task.id);
        });
      }
    }

    if (config.worker_name === "all" || config.worker_name === "publisher-worker") {
      const stalePublishJobs = await schedules.listExpiredRunningPublishJobs(now, recoveryLimit);
      if (stalePublishJobs.length > 0) {
        await logger.emit({
          process_id: supervisor.process_id,
          severity: "warning",
          event_type: "worker.recovered_expired_publish_jobs",
          source_type: "worker",
          source_id: supervisor.process_id,
          message: `Recovered ${stalePublishJobs.length} expired publish job leases`,
          payload: {
            worker_name: config.worker_name,
            publish_job_ids: stalePublishJobs.map((job) => job.id),
          },
        });
      }
      for (const job of stalePublishJobs) {
        await context.requestContext.run({ request_id: newId() }, async () => {
          await context.commands.markPublishFailed.execute(job.id, "LEASE_EXPIRED", "publish worker lease expired");
        });
      }
    }

    if (config.worker_name === "all" || config.worker_name === "ingestion-worker") {
      const staleFetchRuns = await sources.listExpiredRunningFetchRuns(now, recoveryLimit);
      if (staleFetchRuns.length > 0) {
        await logger.emit({
          process_id: supervisor.process_id,
          severity: "warning",
          event_type: "worker.recovered_expired_fetch_runs",
          source_type: "worker",
          source_id: supervisor.process_id,
          message: `Recovered ${staleFetchRuns.length} expired source fetch run leases`,
          payload: {
            worker_name: config.worker_name,
            source_fetch_run_ids: staleFetchRuns.map((run) => run.id),
          },
        });
      }
      for (const run of staleFetchRuns) {
        await context.requestContext.run({ request_id: newId() }, async () => {
          await context.commands.expireSourceFetchRunLease.execute(run.id);
        });
      }
    }

    if (config.worker_name === "all" || config.worker_name === "engagement-worker" || config.worker_name === "editorial-worker") {
      const staleJobTypes = config.worker_name === "engagement-worker"
        ? ENGAGEMENT_WORKER_JOB_TYPES
        : config.worker_name === "editorial-worker"
          ? EDITORIAL_WORKER_JOB_TYPES
          : [...ENGAGEMENT_WORKER_JOB_TYPES, ...EDITORIAL_WORKER_JOB_TYPES];
      const staleWorkerJobs = await workerJobs.listExpiredRunning(now, recoveryLimit, staleJobTypes);
      if (staleWorkerJobs.length > 0) {
        await logger.emit({
          process_id: supervisor.process_id,
          severity: "warning",
          event_type: "worker.recovered_expired_worker_jobs",
          source_type: "worker",
          source_id: supervisor.process_id,
          message: `Recovered ${staleWorkerJobs.length} expired worker job leases`,
          payload: {
            worker_name: config.worker_name,
            worker_job_ids: staleWorkerJobs.map((job) => job.id),
          },
        });
      }
      for (const job of staleWorkerJobs) {
        await context.requestContext.run({ request_id: newId() }, async () => {
          await context.commands.failWorkerJob.execute(job.id, "LEASE_EXPIRED", "worker job lease expired");
        });
      }
    }
  }

  async function claimNextDispatcher(): Promise<{ dispatcher: WorkerDispatcher<unknown>; job: unknown } | null> {
    if (dispatchers.length === 0) {
      return null;
    }

    for (let offset = 0; offset < dispatchers.length; offset += 1) {
      const index = (nextDispatcherIndex + offset) % dispatchers.length;
      const dispatcher = dispatchers[index];
      const job = await dispatcher.claim();
      if (!job) {
        continue;
      }

      nextDispatcherIndex = (index + 1) % dispatchers.length;
      return { dispatcher, job };
    }

    return null;
  }
}

function createDispatchers(
  workerName: WorkerName,
  deps: {
    runtime: SqliteAgentRuntimeRepository;
    schedules: SqliteSchedulesRepository;
    sources: SqliteSourcesRepository;
    workerJobs: SqliteWorkerJobsRepository;
    context: Awaited<ReturnType<typeof buildAppContext>>;
  },
): Array<WorkerDispatcher<unknown>> {
  const dispatchers: Array<WorkerDispatcher<unknown>> = [];

  if (workerName === "all" || workerName === "ingestion-worker") {
    dispatchers.push({
      name: "source.fetch",
      async claim() {
        const startedAt = new Date().toISOString();
        const run = await deps.sources.claimNextQueuedFetchRun(startedAt, addMinutes(startedAt, 15));
        if (!run) {
          return null;
        }

        const job: SourceFetchJob = {
          job_type: "source.fetch",
          source_fetch_run_id: run.id,
          source_id: run.source_id,
          requested_at: run.started_at,
        };
        return job;
      },
      async execute(job) {
        const payload = job as SourceFetchJob;
        await deps.context.commands.executeSourceFetchRun.execute(payload.source_fetch_run_id, { claimed: true });
      },
    });
  }

  if (workerName === "all" || workerName === "agent-worker") {
    dispatchers.push({
      name: "agent.execute",
      async claim() {
        const startedAt = new Date().toISOString();
        const task = await deps.runtime.claimNextQueuedTask(startedAt, addMinutes(startedAt, 15));
        if (!task) {
          return null;
        }

        assertSupportedAgentTaskType(task.task_type);
        const job: AgentTaskExecuteJob = {
          job_type: task.task_type,
          agent_task_id: task.id,
          workspace_id: task.workspace_id,
          target_type: task.target_type,
          target_id: task.target_id,
          requested_at: task.created_at,
        };
        return job;
      },
      async execute(job) {
        const payload = job as AgentTaskExecuteJob;
        await deps.context.commands.runAgentTask.execute(payload.agent_task_id, { claimed: true });
      },
    });
  }

  if (workerName === "all" || workerName === "publisher-worker") {
    dispatchers.push({
      name: "publish.execute",
      async claim() {
        const now = new Date().toISOString();
        const job = await deps.schedules.claimNextReadyPublishJob(now, now, addMinutes(now, 15));
        if (!job) {
          return null;
        }

        const schedule = await deps.schedules.findScheduleById(job.schedule_id);
        if (!schedule) {
          throw new Error(`publish schedule ${job.schedule_id} not found for claimed publish job ${job.id}`);
        }

        const payload: PublishExecuteJob = {
          job_type: "publish.execute",
          publish_job_id: job.id,
          workspace_id: schedule.workspace_id,
          schedule_id: schedule.id,
          account_id: schedule.account_id,
          draft_id: schedule.draft_id,
          idempotency_key: job.idempotency_key,
          requested_at: job.run_after,
        };
        return payload;
      },
      async execute(job) {
        const payload = job as PublishExecuteJob;
        await deps.context.commands.executePublishJob.execute(payload.publish_job_id, { claimed: true });
      },
    });
  }

  if (workerName === "all" || workerName === "engagement-worker") {
    dispatchers.push({
      name: "engagement.worker.job",
      async claim() {
        const now = new Date().toISOString();
        return deps.workerJobs.claimNextReady(ENGAGEMENT_WORKER_JOB_TYPES, now, now, addMinutes(now, 15));
      },
      async execute(job) {
        const payload = job as { id: string };
        await deps.context.commands.runWorkerJob.execute(payload.id, { claimed: true });
      },
    });
  }

  if (workerName === "all" || workerName === "editorial-worker") {
    dispatchers.push({
      name: "editorial.worker.job",
      async claim() {
        const now = new Date().toISOString();
        return deps.workerJobs.claimNextReady(EDITORIAL_WORKER_JOB_TYPES, now, now, addMinutes(now, 15));
      },
      async execute(job) {
        const payload = job as { id: string };
        await deps.context.commands.runWorkerJob.execute(payload.id, { claimed: true });
      },
    });
  }

  return dispatchers;
}

function assertSupportedAgentTaskType(taskType: string): asserts taskType is AgentTaskJobType {
  if (!SUPPORTED_AGENT_TASK_TYPES.has(taskType as AgentTaskJobType)) {
    throw new Error(`unsupported agent task type for worker execution: ${taskType}`);
  }
}

function addMinutes(isoTimestamp: string, minutes: number): string {
  return new Date(new Date(isoTimestamp).getTime() + minutes * 60_000).toISOString();
}

function summarizeJob(job: unknown): Record<string, unknown> {
  if (!job || typeof job !== "object") {
    return { raw: job };
  }

  const value = job as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => {
      return key.endsWith("_id")
        || key === "job_type"
        || key === "workspace_id"
        || key === "task_type";
    }),
  );
}
