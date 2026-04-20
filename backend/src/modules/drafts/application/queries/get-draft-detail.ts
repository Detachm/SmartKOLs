import { AppError } from "../../../../core/errors/app-error";
import type { DraftVersionRepository } from "../ports/draft-version-repository";
import type { DraftsRepository } from "../ports/drafts-repository";

export interface GetDraftDetailDependencies {
  drafts: DraftsRepository;
  versions: DraftVersionRepository;
}

export class GetDraftDetail {
  constructor(private readonly deps: GetDraftDetailDependencies) {}

  async execute(draftId: string) {
    const draft = await this.deps.drafts.findById(draftId);
    if (!draft) {
      throw new AppError("NOT_FOUND", "draft not found", {
        details: { draft_id: draftId },
      });
    }

    const currentVersion = draft.current_version_id
      ? await this.deps.versions.findById(draft.current_version_id)
      : null;
    const reviews = await this.deps.drafts.listReviewsByDraftId(draftId);

    return {
      draft,
      current_version: currentVersion ?? undefined,
      reviews,
    };
  }
}
