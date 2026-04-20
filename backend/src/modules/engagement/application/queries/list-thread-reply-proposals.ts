import { AppError } from "../../../../core/errors/app-error";
import type { EngagementRepository } from "../ports/engagement-repository";

export interface ListThreadReplyProposalsDependencies {
  engagement: EngagementRepository;
}

export class ListThreadReplyProposals {
  constructor(private readonly deps: ListThreadReplyProposalsDependencies) {}

  async execute(threadId: string) {
    const thread = await this.deps.engagement.findThreadById(threadId);
    if (!thread) {
      throw new AppError("NOT_FOUND", "engagement thread not found", {
        details: { thread_id: threadId },
      });
    }

    return {
      proposals: await this.deps.engagement.listReplyProposalsByThreadId(threadId),
    };
  }
}
