import { AppError } from "../../../../core/errors/app-error";
import {
  requireIntegerInRange,
  requireIsoDateTimeString,
  requireNonEmptyString,
  requireOneOf,
} from "../../../../core/validation/guards";
import type { BriefWorkbenchResponse } from "../../../../contracts/api/account-workbenches";
import type { AccountsRepository } from "../../../accounts/application/ports/accounts-repository";
import type { ContentBriefDetailResponse, ContentBriefListResponse } from "../../../../contracts/api/content-briefs";
import type { Source } from "../../../sources/domain/source";
import type { AccountSourceDocumentListResponse, SourceListResponse } from "../../../../contracts/api/sources";
import type { TrendListResponse } from "../../../../contracts/api/trends";
import type { ContentBriefsRepository } from "../ports/content-briefs-repository";
import type { SourceWatchlistsRepository } from "../../../editorial/application/ports/source-watchlists-repository";
import type { RecurringBriefPlansRepository } from "../../../editorial/application/ports/recurring-brief-plans-repository";
import type { TrendsRepository } from "../../../trends/application/ports/trends-repository";
import type { SourcesRepository } from "../../../sources/application/ports/sources-repository";
import { buildContentBriefQualitySummary } from "../content-brief-quality";
import { mapContentBriefResponse } from "../content-brief-response";

export interface BriefWorkbenchDocumentsReadModel {
  listAccountSourceDocuments(input: {
    account_id: string;
    source_id?: string;
    source_type?: Source["type"];
    source_status?: Source["status"];
    query?: string;
    published_from?: string;
    published_to?: string;
    limit: number;
  }): Promise<AccountSourceDocumentListResponse>;
}

export interface GetBriefWorkbenchInput {
  account_id: string;
  selected_brief_id?: string;
  source_id?: string;
  source_type?: Source["type"];
  source_status?: Source["status"];
  query?: string;
  published_from?: string;
  published_to?: string;
  brief_limit?: number;
  document_limit?: number;
}

export interface GetBriefWorkbenchDependencies {
  accounts: AccountsRepository;
  contentBriefs: ContentBriefsRepository;
  sources: SourcesRepository;
  trends: TrendsRepository;
  sourceDocuments: BriefWorkbenchDocumentsReadModel;
  watchlists: SourceWatchlistsRepository;
  recurringPlans: RecurringBriefPlansRepository;
}

export class GetBriefWorkbench {
  constructor(private readonly deps: GetBriefWorkbenchDependencies) {}

  async execute(input: GetBriefWorkbenchInput): Promise<BriefWorkbenchResponse> {
    const accountId = requireNonEmptyString(input.account_id, "account_id");
    const account = await this.deps.accounts.findById(accountId);
    if (!account) {
      throw new AppError("NOT_FOUND", "account not found", {
        details: { account_id: accountId },
      });
    }

    const briefLimit = input.brief_limit === undefined ? 50 : requireIntegerInRange(input.brief_limit, "brief_limit", 1, 200);
    const documentLimit = input.document_limit === undefined ? 120 : requireIntegerInRange(input.document_limit, "document_limit", 1, 500);
    const publishedFrom = input.published_from ? requireIsoDateTimeString(input.published_from, "published_from") : undefined;
    const publishedTo = input.published_to ? requireIsoDateTimeString(input.published_to, "published_to") : undefined;
    if (publishedFrom && publishedTo && Date.parse(publishedFrom) > Date.parse(publishedTo)) {
      throw new AppError("VALIDATION_ERROR", "published_from must be earlier than or equal to published_to", {
        details: { published_from: publishedFrom, published_to: publishedTo },
      });
    }

    const [sources, trends, briefs, documents, watchlists, recurringPlans] = await Promise.all([
      this.listSources(accountId),
      this.listTrends(account.workspace_id),
      this.listBriefs(accountId, briefLimit),
      this.deps.sourceDocuments.listAccountSourceDocuments({
        account_id: accountId,
        source_id: input.source_id ? requireNonEmptyString(input.source_id, "source_id") : undefined,
        source_type: input.source_type
          ? requireOneOf(input.source_type, "source_type", ["rss", "website", "twitter", "youtube", "substack", "telegram"] as const)
          : undefined,
        source_status: input.source_status
          ? requireOneOf(input.source_status, "source_status", ["active", "paused", "error"] as const)
          : undefined,
        query: typeof input.query === "string" && input.query.trim() !== "" ? input.query.trim() : undefined,
        published_from: publishedFrom,
        published_to: publishedTo,
        limit: documentLimit,
      }),
      this.deps.watchlists.listByAccountId(accountId),
      this.listRecurringPlans(accountId),
    ]);
    const selectedBriefId = input.selected_brief_id?.trim() || briefs.briefs[0]?.brief.id;
    const selectedBrief = selectedBriefId
      ? await this.getBriefDetail(selectedBriefId, accountId)
      : undefined;

    return {
      account: {
        id: account.id,
        workspace_id: account.workspace_id,
      },
      sources: sources.sources,
      trends: trends.trends,
      briefs: briefs.briefs,
      documents: documents.documents,
      watchlists,
      recurring_plans: recurringPlans,
      selected_brief: selectedBrief,
    };
  }

  private async listSources(accountId: string): Promise<SourceListResponse> {
    return {
      sources: await this.deps.sources.listSourcesByAccountId(accountId),
    };
  }

  private async listTrends(workspaceId: string): Promise<TrendListResponse> {
    return {
      trends: await this.deps.trends.listByWorkspaceId(workspaceId),
    };
  }

  private async listBriefs(accountId: string, limit: number): Promise<ContentBriefListResponse> {
    const briefs = await this.deps.contentBriefs.listBriefsByAccountId(accountId, limit);
    const briefIds = briefs.map((brief) => brief.id);
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

  private async listRecurringPlans(accountId: string): Promise<BriefWorkbenchResponse["recurring_plans"]> {
    const [plans, watchlists] = await Promise.all([
      this.deps.recurringPlans.listByAccountId(accountId),
      this.deps.watchlists.listByAccountId(accountId),
    ]);
    const watchlistMap = new Map(watchlists.map((watchlist) => [watchlist.id, watchlist]));

    return plans.map((plan) => ({
      plan,
      watchlist: plan.strategy_body.watchlist_id ? watchlistMap.get(plan.strategy_body.watchlist_id) : undefined,
      queued_campaign_count: plan.strategy_body.campaign_queue.filter((item) => item.status === "queued").length,
    }));
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
