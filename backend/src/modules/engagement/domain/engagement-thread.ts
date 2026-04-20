import { requireNonEmptyString, requireOneOf } from "../../../core/validation/guards";

export type EngagementChannel = "mention" | "reply" | "dm" | "comment";
export type EngagementClassification = "collab" | "commerce" | "spam" | "normal" | "support";
export type EngagementThreadStatus = "open" | "pending_action" | "closed" | "ignored";

export interface EngagementThread {
  id: string;
  workspace_id: string;
  account_id: string;
  channel: EngagementChannel;
  external_thread_id: string;
  counterpart_handle?: string;
  classification: EngagementClassification;
  status: EngagementThreadStatus;
  last_message_at: string;
  created_at: string;
}

export function createEngagementThread(thread: EngagementThread): EngagementThread {
  return {
    id: requireNonEmptyString(thread.id, "id"),
    workspace_id: requireNonEmptyString(thread.workspace_id, "workspace_id"),
    account_id: requireNonEmptyString(thread.account_id, "account_id"),
    channel: requireOneOf(thread.channel, "channel", ["mention", "reply", "dm", "comment"] as const),
    external_thread_id: requireNonEmptyString(thread.external_thread_id, "external_thread_id"),
    counterpart_handle: thread.counterpart_handle?.trim() || undefined,
    classification: requireOneOf(thread.classification, "classification", ["collab", "commerce", "spam", "normal", "support"] as const),
    status: requireOneOf(thread.status, "status", ["open", "pending_action", "closed", "ignored"] as const),
    last_message_at: requireNonEmptyString(thread.last_message_at, "last_message_at"),
    created_at: requireNonEmptyString(thread.created_at, "created_at"),
  };
}
