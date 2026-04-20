import {
  requireIntegerInRange,
  requireIsoDateTimeString,
  requireNonEmptyString,
  requireOneOf,
} from "../../../../core/validation/guards";
import { AppError } from "../../../../core/errors/app-error";
import type { AccountSourceDocumentListResponse } from "../../../../contracts/api/sources";
import type { AccountsRepository } from "../../../accounts/application/ports/accounts-repository";
import type { Source } from "../../domain/source";

export interface ListAccountSourceDocumentsInput {
  account_id: string;
  source_id?: string;
  source_ids?: string[];
  source_type?: Source["type"];
  source_types?: Source["type"][];
  source_status?: Source["status"];
  query?: string;
  published_from?: string;
  published_to?: string;
  limit?: number;
}

export interface AccountSourceDocumentsReadModel {
  listAccountSourceDocuments(input: {
    account_id: string;
    source_id?: string;
    source_ids?: string[];
    source_type?: Source["type"];
    source_types?: Source["type"][];
    source_status?: Source["status"];
    query?: string;
    published_from?: string;
    published_to?: string;
    limit: number;
  }): Promise<AccountSourceDocumentListResponse>;
}

export interface ListAccountSourceDocumentsDependencies {
  accounts: AccountsRepository;
  readModel: AccountSourceDocumentsReadModel;
}

export class ListAccountSourceDocuments {
  constructor(private readonly deps: ListAccountSourceDocumentsDependencies) {}

  async execute(input: ListAccountSourceDocumentsInput): Promise<AccountSourceDocumentListResponse> {
    const account = await this.deps.accounts.findById(requireNonEmptyString(input.account_id, "account_id"));
    if (!account) {
      throw new AppError("NOT_FOUND", "account not found", {
        details: { account_id: input.account_id },
      });
    }

    const publishedFrom = input.published_from ? requireIsoDateTimeString(input.published_from, "published_from") : undefined;
    const publishedTo = input.published_to ? requireIsoDateTimeString(input.published_to, "published_to") : undefined;
    if (publishedFrom && publishedTo && Date.parse(publishedFrom) > Date.parse(publishedTo)) {
      throw new AppError("VALIDATION_ERROR", "published_from must be earlier than or equal to published_to", {
        details: { published_from: publishedFrom, published_to: publishedTo },
      });
    }

    return this.deps.readModel.listAccountSourceDocuments({
      account_id: account.id,
      source_id: input.source_id ? requireNonEmptyString(input.source_id, "source_id") : undefined,
      source_ids: Array.isArray(input.source_ids)
        ? Array.from(new Set(input.source_ids.map((item) => requireNonEmptyString(item, "source_ids"))))
        : undefined,
      source_type: input.source_type
        ? requireOneOf(input.source_type, "source_type", ["rss", "website", "twitter", "youtube", "substack", "telegram"] as const)
        : undefined,
      source_types: Array.isArray(input.source_types)
        ? Array.from(new Set(input.source_types.map((item) => requireOneOf(item, "source_types", ["rss", "website", "twitter", "youtube", "substack", "telegram"] as const))))
        : undefined,
      source_status: input.source_status
        ? requireOneOf(input.source_status, "source_status", ["active", "paused", "error"] as const)
        : undefined,
      query: typeof input.query === "string" && input.query.trim() !== "" ? input.query.trim() : undefined,
      published_from: publishedFrom,
      published_to: publishedTo,
      limit: input.limit === undefined ? 100 : requireIntegerInRange(input.limit, "limit", 1, 500),
    });
  }
}
