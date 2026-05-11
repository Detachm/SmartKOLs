import { AppError } from "../../../../core/errors/app-error";
import { requireNonEmptyString } from "../../../../core/validation/guards";
import type { MessageListResponse } from "../../../../contracts/api/messages";
import type { EngagementRepository } from "../ports/engagement-repository";

export interface ListEngagementMessagesDependencies {
  engagement: EngagementRepository;
}

export class ListEngagementMessages {
  constructor(private readonly deps: ListEngagementMessagesDependencies) {}

  async execute(threadId: string): Promise<MessageListResponse> {
    const normalizedThreadId = requireNonEmptyString(threadId, "thread_id");
    const thread = await this.deps.engagement.findThreadById(normalizedThreadId);
    if (!thread) {
      throw new AppError("NOT_FOUND", "engagement thread not found", {
        details: { thread_id: normalizedThreadId },
      });
    }

    return {
      messages: await this.deps.engagement.listMessagesByThreadId(thread.id),
    };
  }
}
