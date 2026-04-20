import { AppError } from "../../../../core/errors/app-error";
import { requireIntegerInRange, requireNonEmptyString } from "../../../../core/validation/guards";
import type { DraftWorkbenchResponse } from "../../../../contracts/api/account-workbenches";
import type { AccountsRepository } from "../../../accounts/application/ports/accounts-repository";
import type { ContentBriefsRepository } from "../../../content-briefs/application/ports/content-briefs-repository";
import type { TrendsRepository } from "../../../trends/application/ports/trends-repository";
import type { SourcesRepository } from "../../../sources/application/ports/sources-repository";
import { buildContentBriefQualitySummary } from "../../../content-briefs/application/content-brief-quality";
import { mapContentBriefResponse } from "../../../content-briefs/application/content-brief-response";
import type { ContentBriefDetailResponse } from "../../../../contracts/api/content-briefs";
import type { ListDraftsReadModel } from "./list-drafts";

export interface GetDraftWorkbenchInput {
  account_id: string;
  selected_brief_id?: string;
  draft_limit?: number;
  brief_limit?: number;
}

export interface GetDraftWorkbenchDependencies {
  accounts: AccountsRepository;
  drafts: ListDraftsReadModel;
  contentBriefs: ContentBriefsRepository;
  sources: SourcesRepository;
  trends: TrendsRepository;
}

export class GetDraftWorkbench {
  constructor(private readonly deps: GetDraftWorkbenchDependencies) {}

  async execute(input: GetDraftWorkbenchInput): Promise<DraftWorkbenchResponse> {
    const accountId = requireNonEmptyString(input.account_id, "account_id");
    const account = await this.deps.accounts.findById(accountId);
    if (!account) {
      throw new AppError("NOT_FOUND", "account not found", {
        details: { account_id: accountId },
      });
    }

    const draftLimit = input.draft_limit === undefined ? 50 : requireIntegerInRange(input.draft_limit, "draft_limit", 1, 200);
    const briefLimit = input.brief_limit === undefined ? 50 : requireIntegerInRange(input.brief_limit, "brief_limit", 1, 200);
    const [drafts, readyBriefs] = await Promise.all([
      this.deps.drafts.listDrafts({
        account_id: accountId,
        limit: draftLimit,
      }),
      this.listReadyBriefs(accountId, briefLimit),
    ]);
    const selectedBriefId = input.selected_brief_id?.trim() || readyBriefs[0]?.brief.id;
    const selectedBrief = selectedBriefId
      ? await this.getBriefDetail(selectedBriefId, accountId)
      : undefined;

    return {
      account: {
        id: account.id,
        workspace_id: account.workspace_id,
      },
      drafts: drafts.drafts,
      ready_briefs: readyBriefs,
      selected_brief: selectedBrief,
    };
  }

  private async listReadyBriefs(accountId: string, limit: number): Promise<DraftWorkbenchResponse["ready_briefs"]> {
    const briefs = await this.deps.contentBriefs.listBriefsByAccountId(accountId, limit);
    const readyBriefs = briefs.filter((brief) => brief.status === "ready");
    const briefIds = readyBriefs.map((brief) => brief.id);
    const evidence = await this.deps.contentBriefs.listEvidenceByBriefIds(briefIds);
    const evidenceByBriefId = new Map<string, typeof evidence>();
    for (const item of evidence) {
      const items = evidenceByBriefId.get(item.brief_id);
      if (items) {
        items.push(item);
      } else {
        evidenceByBriefId.set(item.brief_id, [item]);
      }
    }

    const [documents, sources] = await Promise.all([
      this.deps.sources.listDocumentsByIds(evidence.map((item) => item.source_document_id)),
      this.deps.sources.listSourcesByAccountId(accountId),
    ]);
    const documentMap = new Map(documents.map((document) => [document.id, document]));
    const sourceMap = new Map(sources.map((source) => [source.id, source]));

    return Promise.all(readyBriefs.map(async (brief) => ({
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
    })));
  }

  private async getBriefDetail(briefId: string, accountId: string): Promise<ContentBriefDetailResponse> {
    const brief = await this.deps.contentBriefs.findBriefById(requireNonEmptyString(briefId, "selected_brief_id"));
    if (!brief || brief.account_id !== accountId) {
      throw new AppError("NOT_FOUND", "content brief not found", {
        details: { brief_id: briefId, account_id: accountId },
      });
    }

    const evidence = await this.deps.contentBriefs.listEvidenceByBriefId(brief.id);
    const [documents, sources] = await Promise.all([
      this.deps.sources.listDocumentsByIds(evidence.map((item) => item.source_document_id)),
      this.deps.sources.listSourcesByAccountId(accountId),
    ]);
    const documentMap = new Map(documents.map((document) => [document.id, document]));
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
