import { AppError } from "../../../core/errors/app-error";
import { requireNonEmptyString, requireOneOf } from "../../../core/validation/guards";

export type ReplyProposalStatus = "pending_review" | "approved" | "rejected" | "sent";

export interface ReplyProposal {
  id: string;
  workspace_id: string;
  account_id: string;
  thread_id: string;
  agent_task_id: string;
  agent_run_id: string;
  status: ReplyProposalStatus;
  content: string;
  rationale: string;
  connector_request_id?: string;
  external_reply_id?: string;
  created_at: string;
  reviewed_at?: string;
  sent_at?: string;
}

export function createReplyProposal(input: Omit<ReplyProposal, "status">): ReplyProposal {
  return {
    id: requireNonEmptyString(input.id, "id"),
    workspace_id: requireNonEmptyString(input.workspace_id, "workspace_id"),
    account_id: requireNonEmptyString(input.account_id, "account_id"),
    thread_id: requireNonEmptyString(input.thread_id, "thread_id"),
    agent_task_id: requireNonEmptyString(input.agent_task_id, "agent_task_id"),
    agent_run_id: requireNonEmptyString(input.agent_run_id, "agent_run_id"),
    status: "pending_review",
    content: requireNonEmptyString(input.content, "content"),
    rationale: requireNonEmptyString(input.rationale, "rationale"),
    connector_request_id: input.connector_request_id?.trim() || undefined,
    external_reply_id: input.external_reply_id?.trim() || undefined,
    created_at: requireNonEmptyString(input.created_at, "created_at"),
    reviewed_at: input.reviewed_at?.trim() || undefined,
    sent_at: input.sent_at?.trim() || undefined,
  };
}

export function approveReplyProposal(proposal: ReplyProposal, reviewedAt: string): ReplyProposal {
  if (proposal.status !== "pending_review") {
    throw new AppError("INVALID_STATE", `reply proposal cannot transition from ${proposal.status} to approved`, {
      details: { proposal_id: proposal.id, from: proposal.status, to: "approved" },
    });
  }

  return {
    ...proposal,
    status: "approved",
    reviewed_at: requireNonEmptyString(reviewedAt, "reviewed_at"),
  };
}

export function markReplyProposalSent(
  proposal: ReplyProposal,
  input: { connector_request_id: string; external_reply_id: string; sent_at: string },
): ReplyProposal {
  if (proposal.status !== "approved" && proposal.status !== "pending_review") {
    throw new AppError("INVALID_STATE", `reply proposal cannot transition from ${proposal.status} to sent`, {
      details: { proposal_id: proposal.id, from: proposal.status, to: "sent" },
    });
  }

  return {
    ...proposal,
    status: requireOneOf("sent", "status", ["pending_review", "approved", "rejected", "sent"] as const),
    connector_request_id: requireNonEmptyString(input.connector_request_id, "connector_request_id"),
    external_reply_id: requireNonEmptyString(input.external_reply_id, "external_reply_id"),
    reviewed_at: proposal.reviewed_at ?? requireNonEmptyString(input.sent_at, "sent_at"),
    sent_at: requireNonEmptyString(input.sent_at, "sent_at"),
  };
}
