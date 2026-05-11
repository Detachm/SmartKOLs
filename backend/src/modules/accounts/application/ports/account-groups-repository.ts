import type { AccountGroup } from "../../domain/account-group";

export interface AccountGroupsRepository {
  findById(groupId: string): Promise<AccountGroup | null>;
  findByWorkspaceAndName(workspaceId: string, name: string): Promise<AccountGroup | null>;
  listAll(): Promise<AccountGroup[]>;
  listByWorkspaceId(workspaceId: string): Promise<AccountGroup[]>;
  create(group: AccountGroup): Promise<void>;
}
