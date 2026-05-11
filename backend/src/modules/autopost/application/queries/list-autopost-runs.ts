import { requireIntegerInRange, requireNonEmptyString } from "../../../../core/validation/guards";
import { AppError } from "../../../../core/errors/app-error";
import type { AutopostRunListResponse } from "../../../../contracts/api/autopost-policies";
import type { AccountsRepository } from "../../../accounts/application/ports/accounts-repository";
import type { AutopostRunsRepository } from "../ports/autopost-runs-repository";

export interface ListAutopostRunsDependencies {
  accounts: AccountsRepository;
  runs: AutopostRunsRepository;
}

export class ListAutopostRuns {
  constructor(private readonly deps: ListAutopostRunsDependencies) {}

  async execute(input: { account_id: string; limit?: number }): Promise<AutopostRunListResponse> {
    const accountId = requireNonEmptyString(input.account_id, "account_id");
    const account = await this.deps.accounts.findById(accountId);
    if (!account) {
      throw new AppError("NOT_FOUND", "account not found", {
        details: { account_id: accountId },
      });
    }

    return {
      runs: await this.deps.runs.listByAccountId(
        account.id,
        input.limit === undefined ? 20 : requireIntegerInRange(input.limit, "limit", 1, 100),
      ),
    };
  }
}
