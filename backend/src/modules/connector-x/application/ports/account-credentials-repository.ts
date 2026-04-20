import type { AccountCredential } from "../../domain/account-credential";

export interface AccountCredentialsRepository {
  findByAccountId(accountId: string): Promise<AccountCredential | null>;
  findValidByAccountId(accountId: string): Promise<AccountCredential | null>;
  save(credential: AccountCredential): Promise<void>;
  getWorkspaceIdByAccountId(accountId: string): Promise<string>;
}
