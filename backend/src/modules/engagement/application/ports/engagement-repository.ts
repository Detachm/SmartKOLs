import type { EngagementThread } from "../../domain/engagement-thread";
import type { EngagementMessage } from "../../domain/engagement-message";
import type { ReplyProposal } from "../../domain/reply-proposal";

export interface EngagementRepository {
  findThreadById(threadId: string): Promise<EngagementThread | null>;
  findThreadByExternalId(accountId: string, externalThreadId: string): Promise<EngagementThread | null>;
  listMessagesByThreadId(threadId: string): Promise<EngagementMessage[]>;
  findReplyProposalById(proposalId: string): Promise<ReplyProposal | null>;
  listReplyProposalsByThreadId(threadId: string): Promise<ReplyProposal[]>;
  saveThread(thread: EngagementThread): Promise<void>;
  createMessage(message: EngagementMessage): Promise<boolean>;
  saveReplyProposal(proposal: ReplyProposal): Promise<void>;
}
