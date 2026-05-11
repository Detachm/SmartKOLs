import { requireNonEmptyString, requireOneOf } from "../../../core/validation/guards";

export type EngagementDirection = "incoming" | "outgoing";

export interface EngagementMessage {
  id: string;
  thread_id: string;
  external_message_id?: string;
  direction: EngagementDirection;
  sender_handle?: string;
  content: string;
  raw_payload: string;
  created_at: string;
}

export function createEngagementMessage(message: EngagementMessage): EngagementMessage {
  return {
    id: requireNonEmptyString(message.id, "id"),
    thread_id: requireNonEmptyString(message.thread_id, "thread_id"),
    external_message_id: message.external_message_id?.trim() || undefined,
    direction: requireOneOf(message.direction, "direction", ["incoming", "outgoing"] as const),
    sender_handle: message.sender_handle?.trim() || undefined,
    content: requireNonEmptyString(message.content, "content"),
    raw_payload: requireNonEmptyString(message.raw_payload, "raw_payload"),
    created_at: requireNonEmptyString(message.created_at, "created_at"),
  };
}
