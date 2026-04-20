import type { AccountsControlPlaneResponse } from "../../../../contracts/api/accounts-control-plane";

export interface AccountsControlPlaneReadModel {
  getAccountsControlPlane(workspaceId?: string): Promise<AccountsControlPlaneResponse>;
}

export interface GetAccountsControlPlaneDependencies {
  readModel: AccountsControlPlaneReadModel;
}

export class GetAccountsControlPlane {
  constructor(private readonly deps: GetAccountsControlPlaneDependencies) {}

  async execute(workspaceId?: string): Promise<AccountsControlPlaneResponse> {
    return this.deps.readModel.getAccountsControlPlane(workspaceId);
  }
}
