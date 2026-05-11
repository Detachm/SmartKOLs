import type { ContentBriefsRepository } from "../ports/content-briefs-repository";
import type { TrendsRepository } from "../../../trends/application/ports/trends-repository";
import type { SourcesRepository } from "../../../sources/application/ports/sources-repository";
import { buildContentBriefQualitySummary } from "../content-brief-quality";
import { mapContentBriefResponse } from "../content-brief-response";

export interface ListContentBriefsDependencies {
  contentBriefs: ContentBriefsRepository;
  sources: SourcesRepository;
  trends: TrendsRepository;
}

export class ListContentBriefs {
  constructor(private readonly deps: ListContentBriefsDependencies) {}

  async execute(input: { account_id: string; limit: number }) {
    const briefs = await this.deps.contentBriefs.listBriefsByAccountId(input.account_id, input.limit);
    const briefIds = briefs.map((brief) => brief.id);
    const evidence = await this.deps.contentBriefs.listEvidenceByBriefIds(briefIds);
    const evidenceByBriefId = new Map<string, typeof evidence>();
    for (const item of evidence) {
      const existing = evidenceByBriefId.get(item.brief_id);
      if (existing) {
        existing.push(item);
      } else {
        evidenceByBriefId.set(item.brief_id, [item]);
      }
    }
    const documents = await this.deps.sources.listDocumentsByIds(evidence.map((item) => item.source_document_id));
    const documentMap = new Map(documents.map((document) => [document.id, document]));
    const sources = await this.deps.sources.listSourcesByAccountId(input.account_id);
    const sourceMap = new Map(sources.map((source) => [source.id, source]));

    return {
      briefs: await Promise.all(briefs.map(async (brief) => ({
        brief: mapContentBriefResponse(brief),
        trend: brief.trend_id ? await this.deps.trends.findById(brief.trend_id) ?? undefined : undefined,
        evidence_count: brief.evidence_count,
        quality_summary: buildContentBriefQualitySummary((evidenceByBriefId.get(brief.id) ?? []).flatMap((item) => {
          const document = documentMap.get(item.source_document_id);
          if (!document) {
            return [];
          }

          return [{
            evidence: item,
            document,
            source: sourceMap.get(document.source_id),
          }];
        })),
      }))),
    };
  }
}
