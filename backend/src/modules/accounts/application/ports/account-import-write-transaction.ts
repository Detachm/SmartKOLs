import type { AuditLog } from "../../../audit/domain/audit-log";
import type { Account } from "../../domain/account";
import type { AccountGroup } from "../../domain/account-group";

export interface AccountImportWriteTransaction {
  commitImport(input: {
    groups: AccountGroup[];
    accounts: Account[];
    audit_logs: AuditLog[];
  }): Promise<void>;
}
