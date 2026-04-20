import type { RequestContextStore } from "../../../core/request-context/request-context";
import type { SqliteExecutor } from "../../../infrastructure/db/sqlite-executor";
import { SqliteAuditLogRepository } from "../../audit/infrastructure/sqlite-audit-log-repository";
import type { AccountImportWriteTransaction } from "../application/ports/account-import-write-transaction";
import { SqliteAccountsRepository } from "./sqlite-accounts-repository";
import { SqliteAccountGroupsRepository } from "./sqlite-account-groups-repository";

export class SqliteAccountImportWriteTransaction implements AccountImportWriteTransaction {
  constructor(
    private readonly db: SqliteExecutor,
    private readonly requestContext: RequestContextStore,
  ) {}

  async commitImport(input: Parameters<AccountImportWriteTransaction["commitImport"]>[0]): Promise<void> {
    this.db.transaction((tx) => {
      const groups = new SqliteAccountGroupsRepository(tx);
      const accounts = new SqliteAccountsRepository(tx);
      const auditLogs = new SqliteAuditLogRepository(tx, this.requestContext);

      for (const group of input.groups) {
        groups.create(group);
      }

      for (const account of input.accounts) {
        accounts.create(account);
      }

      for (const auditLog of input.audit_logs) {
        auditLogs.appendSync(auditLog);
      }
    });
  }
}
