import { AppError } from "../../../../core/errors/app-error";
import type { EngagementRepository } from "../ports/engagement-repository";

export interface GetEngagementThreadDependencies {
  engagement: EngagementRepository;
}

export class GetEngagementThread {
  constructor(private readonly deps: GetEngagementThreadDependencies) {}

  async execute(threadId: string) {
    const thread = await this.deps.engagement.findThreadById(threadId);
    if (!thread) {
      throw new AppError("NOT_FOUND", "engagement thread not found", {
        details: { thread_id: threadId },
      });
    }

    const messages = await this.deps.engagement.listMessagesByThreadId(thread.id);

    return {
      thread,
      messages,
    };
  }
}
