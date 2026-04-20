import { AppError } from "../../../../core/errors/app-error";
import type { GenerateDraftResponse } from "../../../../contracts/api/drafts";
import type { ContentBriefsRepository } from "../../../content-briefs/application/ports/content-briefs-repository";
import type { GenerateDraft } from "./generate-draft";

export interface GenerateDraftFromContentBriefDependencies {
  contentBriefs: ContentBriefsRepository;
  generateDraft: GenerateDraft;
}

export class GenerateDraftFromContentBrief {
  constructor(private readonly deps: GenerateDraftFromContentBriefDependencies) {}

  async execute(briefId: string): Promise<GenerateDraftResponse> {
    const brief = await this.deps.contentBriefs.findBriefById(briefId);
    if (!brief) {
      throw new AppError("NOT_FOUND", "content brief not found", {
        details: { brief_id: briefId },
      });
    }

    if (brief.status !== "ready") {
      throw new AppError("INVALID_STATE", "content brief must be ready before draft generation", {
        details: { brief_id: brief.id, status: brief.status },
      });
    }

    return this.deps.generateDraft.execute({
      account_id: brief.account_id,
      trend_id: brief.trend_id,
      content_brief_id: brief.id,
    });
  }
}
