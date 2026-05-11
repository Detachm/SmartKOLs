import { AppError } from "../../../../core/errors/app-error";
import type { ContentBriefEvidenceListResponse } from "../../../../contracts/api/content-briefs";
import type { SourcesRepository } from "../../../sources/application/ports/sources-repository";
import type { ContentBriefsRepository } from "../ports/content-briefs-repository";

export interface GetContentBriefEvidenceDependencies {
  contentBriefs: ContentBriefsRepository;
  sources: SourcesRepository;
}

export class GetContentBriefEvidence {
  constructor(private readonly deps: GetContentBriefEvidenceDependencies) {}

  async execute(briefId: string): Promise<ContentBriefEvidenceListResponse> {
    const brief = await this.deps.contentBriefs.findBriefById(briefId);
    if (!brief) {
      throw new AppError("NOT_FOUND", "content brief not found", {
        details: { brief_id: briefId },
      });
    }

    const evidence = await this.deps.contentBriefs.listEvidenceByBriefId(brief.id);
    const documents = await this.deps.sources.listDocumentsByIds(evidence.map((item) => item.source_document_id));
    const documentMap = new Map(documents.map((document) => [document.id, document]));
    const sources = await this.deps.sources.listSourcesByAccountId(brief.account_id);
    const sourceMap = new Map(sources.map((source) => [source.id, source]));

    return {
      evidence: evidence.flatMap((item) => {
        const document = documentMap.get(item.source_document_id);
        if (!document) {
          return [];
        }

        return [{
          item: {
            id: item.id,
            brief_id: item.brief_id,
            source_document_id: item.source_document_id,
            rank: item.rank,
            usage_reason: item.usage_reason,
            key_claims: item.key_claims,
            quoted_excerpt: item.quoted_excerpt,
            created_at: item.created_at,
          },
          document,
          source: sourceMap.get(document.source_id),
        }];
      }),
    };
  }
}
