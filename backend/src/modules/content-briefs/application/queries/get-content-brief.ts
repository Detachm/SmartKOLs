import { AppError } from "../../../../core/errors/app-error";
import type { SourcesRepository } from "../../../sources/application/ports/sources-repository";
import type { TrendsRepository } from "../../../trends/application/ports/trends-repository";
import type { ContentBriefsRepository } from "../ports/content-briefs-repository";
import { buildContentBriefQualitySummary } from "../content-brief-quality";
import { mapContentBriefResponse } from "../content-brief-response";

export interface GetContentBriefDependencies {
  contentBriefs: ContentBriefsRepository;
  sources: SourcesRepository;
  trends: TrendsRepository;
}

export class GetContentBrief {
  constructor(private readonly deps: GetContentBriefDependencies) {}

  async execute(briefId: string) {
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
    const evidenceEntries = evidence.flatMap((item) => {
      const document = documentMap.get(item.source_document_id);
      if (!document) {
        return [];
      }

      return [{
        evidence: item,
        document,
        source: sourceMap.get(document.source_id),
      }];
    });

    return {
      brief: mapContentBriefResponse(brief),
      trend: brief.trend_id ? await this.deps.trends.findById(brief.trend_id) ?? undefined : undefined,
      evidence: evidenceEntries.map((entry) => ({
        item: {
          id: entry.evidence.id,
          brief_id: entry.evidence.brief_id,
          source_document_id: entry.evidence.source_document_id,
          rank: entry.evidence.rank,
          usage_reason: entry.evidence.usage_reason,
          key_claims: entry.evidence.key_claims,
          quoted_excerpt: entry.evidence.quoted_excerpt,
          created_at: entry.evidence.created_at,
        },
        document: entry.document,
        source: entry.source,
      })),
      quality_summary: buildContentBriefQualitySummary(evidenceEntries),
    };
  }
}
