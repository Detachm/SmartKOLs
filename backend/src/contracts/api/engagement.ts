import type { EngagementMessage } from "../../modules/engagement/domain/engagement-message";
import type { EngagementThread } from "../../modules/engagement/domain/engagement-thread";
import type { ReplyProposal } from "../../modules/engagement/domain/reply-proposal";

export interface EngagementThreadListItem {
  thread: EngagementThread;
  latest_message?: EngagementMessage;
  latest_proposal?: ReplyProposal;
  message_count: number;
}

export interface EngagementThreadListResponse {
  threads: EngagementThreadListItem[];
}

export interface EngagementThreadDetailResponse {
  thread: EngagementThread;
  messages: EngagementMessage[];
}

export interface GenerateReplyProposalResponse {
  task_id: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
}

export interface ReplyProposalDetailResponse {
  proposal: ReplyProposal;
}

export interface ReplyProposalListResponse {
  proposals: ReplyProposal[];
}
