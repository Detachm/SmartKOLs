import { requireNonEmptyString } from "../../../../core/validation/guards";
import type { AccountSurfaceResponse } from "../../../../contracts/api/account-surface";

export interface AccountSurfaceReadModel {
  getAccountSurface(accountId: string): Promise<AccountSurfaceResponse>;
}

export interface GetAccountSurfaceDependencies {
  readModel: AccountSurfaceReadModel;
}

export class GetAccountSurface {
  constructor(private readonly deps: GetAccountSurfaceDependencies) {}

  async execute(accountId: string): Promise<AccountSurfaceResponse> {
    return this.deps.readModel.getAccountSurface(requireNonEmptyString(accountId, "account_id"));
  }
}
