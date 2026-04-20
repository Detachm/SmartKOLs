import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { AccountsRepository } from "../../../accounts/application/ports/accounts-repository";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { SendDirectMessage } from "../../../connector-x/application/commands/send-direct-message";
import type { ReplyToPost } from "../../../connector-x/application/commands/reply-to-post";
import type { QueueAccountAutomationTick } from "../../../orchestration/application/commands/queue-account-automation-tick";
import type { EngagementPoliciesRepository } from "../ports/engagement-policies-repository";
import type { EngagementRepository } from "../ports/engagement-repository";
import { createEngagementMessage } from "../../domain/engagement-message";
import { markReplyProposalSent } from "../../domain/reply-proposal";

export interface SendReplyProposalDependencies {
  engagement: EngagementRepository;
  policies: EngagementPoliciesRepository;
  accounts: AccountsRepository;
  replyToPost: ReplyToPost;
  sendDirectMessage: SendDirectMessage;
  queueAccountAutomationTick: QueueAccountAutomationTick;
  auditLogs: AuditLogRepository;
  clock: Clock;
}

export class SendReplyProposal {
  constructor(private readonly deps: SendReplyProposalDependencies) {}

  async execute(proposalId: string) {
    const proposal = await this.deps.engagement.findReplyProposalById(proposalId);
    if (!proposal) {
      throw new AppError("NOT_FOUND", "reply proposal not found", {
        details: { proposal_id: proposalId },
      });
    }

    const thread = await this.deps.engagement.findThreadById(proposal.thread_id);
    if (!thread) {
      throw new AppError("NOT_FOUND", "engagement thread not found", {
        details: { thread_id: proposal.thread_id },
      });
    }

    const policy = await this.deps.policies.findByAccountId(proposal.account_id);
    if (!policy) {
      throw new AppError("NOT_FOUND", "engagement policy not configured", {
        details: { account_id: proposal.account_id },
      });
    }
    if (policy.status !== "active") {
      throw new AppError("INVALID_STATE", "engagement policy is not active", {
        details: { account_id: proposal.account_id, status: policy.status },
      });
    }
    if (!policy.policy_body.allowed_channels.includes(thread.channel)) {
      throw new AppError("FORBIDDEN", "engagement policy forbids replies on this channel", {
        details: { channel: thread.channel, account_id: proposal.account_id },
      });
    }
    if (policy.policy_body.blocked_classifications.includes(thread.classification)) {
      throw new AppError("FORBIDDEN", "engagement policy forbids replies for this classification", {
        details: { classification: thread.classification, account_id: proposal.account_id },
      });
    }
    if (policy.policy_body.require_manual_approval && proposal.status !== "approved") {
      throw new AppError("FORBIDDEN", "engagement policy requires approved proposal before send", {
        details: { proposal_id: proposal.id, status: proposal.status },
      });
    }

    const account = await this.deps.accounts.findById(proposal.account_id);
    if (!account) {
      throw new AppError("NOT_FOUND", "account not found", {
        details: { account_id: proposal.account_id },
      });
    }

    const sendResult = thread.channel === "dm"
      ? await this.deps.sendDirectMessage.execute({
          account_id: proposal.account_id,
          dm_conversation_id: thread.external_thread_id,
          text: proposal.content,
        })
      : await this.deps.replyToPost.execute({
          account_id: proposal.account_id,
          reply_to_external_post_id: thread.external_thread_id,
          text: proposal.content,
        });
    const externalReplyId = "external_reply_id" in sendResult ? sendResult.external_reply_id : sendResult.external_message_id;
    const externalReplyUrl = "external_reply_url" in sendResult ? sendResult.external_reply_url : undefined;
    const externalThreadId = "external_thread_id" in sendResult ? sendResult.external_thread_id : undefined;

    const sentAt = this.deps.clock.now().toISOString();
    const next = markReplyProposalSent(proposal, {
      connector_request_id: sendResult.connector_request_id,
      external_reply_id: externalReplyId,
      sent_at: sentAt,
    });
    await this.deps.engagement.saveReplyProposal(next);
    await this.deps.engagement.createMessage(createEngagementMessage({
      id: newId(),
      thread_id: thread.id,
      external_message_id: externalReplyId,
      direction: "outgoing",
      sender_handle: account.handle,
      content: proposal.content,
      raw_payload: JSON.stringify({
        connector_request_id: sendResult.connector_request_id,
        external_reply_id: externalReplyId,
        external_reply_url: externalReplyUrl,
        external_thread_id: externalThreadId,
      }),
      created_at: sentAt,
    }));
    await this.deps.engagement.saveThread({
      ...thread,
      status: "open",
      last_message_at: sentAt,
    });
    await this.deps.auditLogs.append({
      id: newId(),
      workspace_id: proposal.workspace_id,
      actor_type: "system",
      entity_type: "engagement_reply_proposal",
      entity_id: proposal.id,
      action: "engagement_reply_proposal.sent",
      before_state: JSON.stringify(proposal),
      after_state: JSON.stringify(next),
      created_at: sentAt,
    });
    await this.deps.queueAccountAutomationTick.execute({
      account_id: proposal.account_id,
      trigger_kind: "system",
      create_if_missing: true,
    });

    return next;
  }
}
