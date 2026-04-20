import { AppError } from "../../../../core/errors/app-error";
import type { EngagementRepository } from "../ports/engagement-repository";

export interface GetReplyProposalDependencies {
  engagement: EngagementRepository;
}

export class GetReplyProposal {
  constructor(private readonly deps: GetReplyProposalDependencies) {}

  async execute(proposalId: string) {
    const proposal = await this.deps.engagement.findReplyProposalById(proposalId);
    if (!proposal) {
      throw new AppError("NOT_FOUND", "reply proposal not found", {
        details: { proposal_id: proposalId },
      });
    }

    return { proposal };
  }
}
