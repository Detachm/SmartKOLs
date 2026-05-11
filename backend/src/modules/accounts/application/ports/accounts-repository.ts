import type { Account } from "../../domain/account";

export interface AccountsRepository {
  findById(accountId: string): Promise<Account | null>;
  listByIds(accountIds: string[]): Promise<Account[]>;
  findByWorkspaceAndHandle(workspaceId: string, handle: string): Promise<Account | null>;
  listAll(): Promise<Account[]>;
  listByWorkspaceId(workspaceId: string): Promise<Account[]>;
  create(account: Account): Promise<void>;
  save(account: Account): Promise<void>;
  delete(accountId: string): Promise<void>;
}
