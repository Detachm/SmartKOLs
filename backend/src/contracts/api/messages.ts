import type { EngagementMessage } from "../../modules/engagement/domain/engagement-message";

export interface MessageListResponse {
  messages: EngagementMessage[];
}
