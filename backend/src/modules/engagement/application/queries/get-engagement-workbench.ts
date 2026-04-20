import { AppError } from "../../../../core/errors/app-error";
import { requireIntegerInRange, requireNonEmptyString, requireOneOf } from "../../../../core/validation/guards";
import type { EngagementWorkbenchResponse } from "../../../../contracts/api/account-workbenches";
import type { AccountsRepository } from "../../../accounts/application/ports/accounts-repository";
import type { EngagementPoliciesRepository } from "../ports/engagement-policies-repository";
import type { EngagementRepository } from "../ports/engagement-repository";
import type { EngagementChannel, EngagementClassification, EngagementThreadStatus } from "../../domain/engagement-thread";
import type { EngagementThreadListReadModel } from "./list-account-engagement-threads";

export interface GetEngagementWorkbenchInput {
  account_id: string;
  thread_id?: string;
  channel?: EngagementChannel;
  classification?: EngagementClassification;
  status?: EngagementThreadStatus;
  limit?: number;
}

export interface GetEngagementWorkbenchDependencies {
  accounts: AccountsRepository;
  threads: EngagementThreadListReadModel;
  engagement: EngagementRepository;
  policies: EngagementPoliciesRepository;
}

export class GetEngagementWorkbench {
  constructor(private readonly deps: GetEngagementWorkbenchDependencies) {}

  async execute(input: GetEngagementWorkbenchInput): Promise<EngagementWorkbenchResponse> {
    const accountId = requireNonEmptyString(input.account_id, "account_id");
    const account = await this.deps.accounts.findById(accountId);
    if (!account) {
      throw new AppError("NOT_FOUND", "account not found", {
        details: { account_id: accountId },
      });
    }

    const limit = input.limit === undefined ? 100 : requireIntegerInRange(input.limit, "limit", 1, 200);
    const [threads, policy, selectedThread] = await Promise.all([
      this.deps.threads.listAccountThreads({
        account_id: accountId,
        channel: input.channel ? requireOneOf(input.channel, "channel", ["mention", "reply", "dm", "comment"] as const) : undefined,
        classification: input.classification
          ? requireOneOf(input.classification, "classification", ["collab", "commerce", "spam", "normal", "support"] as const)
          : undefined,
        status: input.status ? requireOneOf(input.status, "status", ["open", "pending_action", "closed", "ignored"] as const) : undefined,
        limit,
      }),
      this.deps.policies.findByAccountId(accountId),
      input.thread_id ? this.getThreadDetail(input.thread_id, accountId) : Promise.resolve(undefined),
    ]);

    return {
      account: {
        id: account.id,
        workspace_id: account.workspace_id,
      },
      threads: threads.threads,
      selected_thread: selectedThread?.detail,
      proposals: selectedThread?.proposals ?? [],
      policy: policy ?? undefined,
      policy_missing: !policy,
    };
  }

  private async getThreadDetail(threadId: string, accountId: string): Promise<{
    detail: EngagementWorkbenchResponse["selected_thread"];
    proposals: EngagementWorkbenchResponse["proposals"];
  }> {
    const thread = await this.deps.engagement.findThreadById(requireNonEmptyString(threadId, "thread_id"));
    if (!thread || thread.account_id !== accountId) {
      throw new AppError("NOT_FOUND", "engagement thread not found", {
        details: { thread_id: threadId, account_id: accountId },
      });
    }

    const [messages, proposals] = await Promise.all([
      this.deps.engagement.listMessagesByThreadId(thread.id),
      this.deps.engagement.listReplyProposalsByThreadId(thread.id),
    ]);

    return {
      detail: {
        thread,
        messages,
      },
      proposals,
    };
  }
}
