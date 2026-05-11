import { AppError } from "../../../../core/errors/app-error";
import { requireNonEmptyString } from "../../../../core/validation/guards";
import type { DraftReviewListResponse } from "../../../../contracts/api/draft-reviews";
import type { DraftsRepository } from "../ports/drafts-repository";

export interface ListDraftReviewsDependencies {
  drafts: DraftsRepository;
}

export class ListDraftReviews {
  constructor(private readonly deps: ListDraftReviewsDependencies) {}

  async execute(draftId: string): Promise<DraftReviewListResponse> {
    const normalizedDraftId = requireNonEmptyString(draftId, "draft_id");
    const draft = await this.deps.drafts.findById(normalizedDraftId);
    if (!draft) {
      throw new AppError("NOT_FOUND", "draft not found", {
        details: { draft_id: normalizedDraftId },
      });
    }

    return {
      reviews: await this.deps.drafts.listReviewsByDraftId(draft.id),
    };
  }
}
