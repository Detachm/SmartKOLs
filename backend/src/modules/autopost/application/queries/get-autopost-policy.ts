import { AppError } from "../../../../core/errors/app-error";
import type { Clock } from "../../../../core/time/clock";
import type { AccountSourceDocumentsReadModel } from "../../../sources/application/queries/list-account-source-documents";
import type { SourcesRepository } from "../../../sources/application/ports/sources-repository";
import {
  summarizeAutopostSourceFreshness,
} from "../../domain/source-freshness";
import type { AutopostPoliciesRepository } from "../ports/autopost-policies-repository";

export interface GetAutopostPolicyDependencies {
  policies: AutopostPoliciesRepository;
  sources: SourcesRepository;
  sourceDocuments: AccountSourceDocumentsReadModel;
  clock: Clock;
}

export class GetAutopostPolicy {
  constructor(private readonly deps: GetAutopostPolicyDependencies) {}

  async execute(accountId: string) {
    const policy = await this.deps.policies.findByAccountId(accountId);
    if (!policy) {
      throw new AppError("NOT_FOUND", "autopost policy not found", {
        details: { account_id: accountId },
      });
    }

    const startedAt = this.deps.clock.now().toISOString();
    const relevantSources = (await this.deps.sources.listSourcesByAccountId(accountId))
      .filter((source) => source.status === "active" && policy.content_strategy_body.source_types.includes(source.type));
    const publishedFrom = new Date(
      Date.parse(startedAt) - policy.content_strategy_body.max_source_age_days * 24 * 60 * 60 * 1000,
    ).toISOString();
    const scopedDocuments = await this.deps.sourceDocuments.listAccountSourceDocuments({
      account_id: accountId,
      source_types: policy.content_strategy_body.source_types,
      source_status: "active",
      published_from: publishedFrom,
      published_to: startedAt,
      limit: 200,
    });
    const latestDocumentPublishedAt = scopedDocuments.documents.reduce<string | undefined>((latest, item) => {
      const candidate = item.document.published_at ?? item.document.created_at;
      if (!candidate) {
        return latest;
      }
      if (!latest || candidate > latest) {
        return candidate;
      }
      return latest;
    }, undefined);

    return {
      policy,
      freshness: summarizeAutopostSourceFreshness({
        started_at: startedAt,
        source_types: policy.content_strategy_body.source_types,
        relevant_sources: relevantSources,
        latest_document_published_at: latestDocumentPublishedAt,
      }),
    };
  }
}
