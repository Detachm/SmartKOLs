import type { AccountsRepository } from "../ports/accounts-repository";

export interface ListAccountsDependencies {
  accounts: AccountsRepository;
}

export class ListAccounts {
  constructor(private readonly deps: ListAccountsDependencies) {}

  async execute(input?: { workspace_id?: string }) {
    const accounts = input?.workspace_id
      ? await this.deps.accounts.listByWorkspaceId(input.workspace_id)
      : await this.deps.accounts.listAll();

    return { accounts };
  }
}
