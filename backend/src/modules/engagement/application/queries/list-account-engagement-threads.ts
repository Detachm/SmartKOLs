import { requireIntegerInRange, requireNonEmptyString, requireOneOf } from "../../../../core/validation/guards";
import type { EngagementThreadListResponse } from "../../../../contracts/api/engagement";
import type {
  EngagementChannel,
  EngagementClassification,
  EngagementThreadStatus,
} from "../../domain/engagement-thread";

export interface ListAccountEngagementThreadsInput {
  account_id: string;
  channel?: EngagementChannel;
  classification?: EngagementClassification;
  status?: EngagementThreadStatus;
  limit?: number;
}

export interface EngagementThreadListReadModel {
  listAccountThreads(input: {
    account_id: string;
    channel?: EngagementChannel;
    classification?: EngagementClassification;
    status?: EngagementThreadStatus;
    limit: number;
  }): Promise<EngagementThreadListResponse>;
}

export interface ListAccountEngagementThreadsDependencies {
  readModel: EngagementThreadListReadModel;
}

export class ListAccountEngagementThreads {
  constructor(private readonly deps: ListAccountEngagementThreadsDependencies) {}

  async execute(input: ListAccountEngagementThreadsInput): Promise<EngagementThreadListResponse> {
    return this.deps.readModel.listAccountThreads({
      account_id: requireNonEmptyString(input.account_id, "account_id"),
      channel: input.channel ? requireOneOf(input.channel, "channel", ["mention", "reply", "dm", "comment"] as const) : undefined,
      classification: input.classification
        ? requireOneOf(input.classification, "classification", ["collab", "commerce", "spam", "normal", "support"] as const)
        : undefined,
      status: input.status ? requireOneOf(input.status, "status", ["open", "pending_action", "closed", "ignored"] as const) : undefined,
      limit: input.limit === undefined ? 100 : requireIntegerInRange(input.limit, "limit", 1, 200),
    });
  }
}
