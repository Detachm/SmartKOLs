import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { QueueSendReplyProposalJob } from "../../../execution/application/commands/queue-send-reply-proposal-job";
import type { QueueAccountAutomationTick } from "../../../orchestration/application/commands/queue-account-automation-tick";
import type { EngagementRepository } from "../ports/engagement-repository";
import { approveReplyProposal } from "../../domain/reply-proposal";

export interface ApproveReplyProposalDependencies {
  engagement: EngagementRepository;
  queueSendReplyProposalJob: QueueSendReplyProposalJob;
  queueAccountAutomationTick: QueueAccountAutomationTick;
  auditLogs: AuditLogRepository;
  clock: Clock;
}

export class ApproveReplyProposal {
  constructor(private readonly deps: ApproveReplyProposalDependencies) {}

  async execute(proposalId: string) {
    const proposal = await this.deps.engagement.findReplyProposalById(proposalId);
    if (!proposal) {
      throw new AppError("NOT_FOUND", "reply proposal not found", {
        details: { proposal_id: proposalId },
      });
    }

    const next = approveReplyProposal(proposal, this.deps.clock.now().toISOString());
    await this.deps.engagement.saveReplyProposal(next);
    await this.deps.auditLogs.append({
      id: newId(),
      workspace_id: proposal.workspace_id,
      actor_type: "user",
      entity_type: "engagement_reply_proposal",
      entity_id: proposal.id,
      action: "engagement_reply_proposal.approved",
      before_state: JSON.stringify(proposal),
      after_state: JSON.stringify(next),
      created_at: this.deps.clock.now().toISOString(),
    });
    await this.deps.queueSendReplyProposalJob.execute(next.id);
    await this.deps.queueAccountAutomationTick.execute({
      account_id: proposal.account_id,
      trigger_kind: "system",
      create_if_missing: true,
    });

    return next;
  }
}
