import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { EngagementRepository } from "../../../engagement/application/ports/engagement-repository";
import type { WorkerJobsRepository } from "../ports/worker-jobs-repository";
import { createWorkerJob } from "../../domain/worker-job";

export interface QueueSendReplyProposalJobDependencies {
  engagement: EngagementRepository;
  workerJobs: WorkerJobsRepository;
  auditLogs: AuditLogRepository;
  clock: Clock;
}

export class QueueSendReplyProposalJob {
  constructor(private readonly deps: QueueSendReplyProposalJobDependencies) {}

  async execute(proposalId: string) {
    const proposal = await this.deps.engagement.findReplyProposalById(proposalId);
    if (!proposal) {
      throw new AppError("NOT_FOUND", "reply proposal not found", {
        details: { proposal_id: proposalId },
      });
    }

    const now = this.deps.clock.now().toISOString();
    const job = createWorkerJob({
      id: newId(),
      workspace_id: proposal.workspace_id,
      job_type: "engagement.reply.execute",
      target_type: "reply_proposal",
      target_id: proposal.id,
      payload: JSON.stringify({ proposal_id: proposal.id }),
      run_after: now,
      created_at: now,
    });
    await this.deps.workerJobs.create(job);
    await this.deps.auditLogs.append({
      id: newId(),
      workspace_id: proposal.workspace_id,
      actor_type: "system",
      entity_type: "worker_job",
      entity_id: job.id,
      action: "worker_job.queued",
      after_state: JSON.stringify(job),
      created_at: now,
    });
    return job;
  }
}
