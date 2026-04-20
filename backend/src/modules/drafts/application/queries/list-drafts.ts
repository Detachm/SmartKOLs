import { requireIntegerInRange, requireNonEmptyString, requireOneOf } from "../../../../core/validation/guards";
import type { DraftListResponse } from "../../../../contracts/api/drafts";
import type { DraftStatus } from "../../domain/draft";

export interface ListDraftsInput {
  workspace_id?: string;
  account_id?: string;
  status?: DraftStatus;
  limit?: number;
}

export interface ListDraftsReadModel {
  listDrafts(input: {
    workspace_id?: string;
    account_id?: string;
    status?: DraftStatus;
    limit: number;
  }): Promise<DraftListResponse>;
}

export interface ListDraftsDependencies {
  readModel: ListDraftsReadModel;
}

export class ListDrafts {
  constructor(private readonly deps: ListDraftsDependencies) {}

  async execute(input?: ListDraftsInput): Promise<DraftListResponse> {
    return this.deps.readModel.listDrafts({
      workspace_id: input?.workspace_id ? requireNonEmptyString(input.workspace_id, "workspace_id") : undefined,
      account_id: input?.account_id ? requireNonEmptyString(input.account_id, "account_id") : undefined,
      status: input?.status ? requireOneOf(input.status, "status", ["pending", "approved", "rejected", "scheduled", "published", "failed"] as const) : undefined,
      limit: input?.limit === undefined ? 50 : requireIntegerInRange(input.limit, "limit", 1, 200),
    });
  }
}
