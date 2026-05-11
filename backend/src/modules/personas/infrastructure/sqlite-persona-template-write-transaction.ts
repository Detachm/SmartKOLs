import type { RequestContextStore } from "../../../core/request-context/request-context";
import type { SqliteExecutor } from "../../../infrastructure/db/sqlite-executor";
import { SqliteAuditLogRepository } from "../../audit/infrastructure/sqlite-audit-log-repository";
import { SqlitePersonasRepository } from "./sqlite-personas-repository";
import type { PersonaTemplateWriteTransaction } from "../application/ports/persona-template-write-transaction";

export class SqlitePersonaTemplateWriteTransaction implements PersonaTemplateWriteTransaction {
  constructor(
    private readonly db: SqliteExecutor,
    private readonly requestContext: RequestContextStore,
  ) {}

  async commitTemplateApplication(input: {
    personas: Parameters<SqlitePersonasRepository["save"]>[0][];
    audit_logs: Parameters<SqliteAuditLogRepository["append"]>[0][];
  }): Promise<void> {
    this.db.transaction((tx) => {
      const personas = new SqlitePersonasRepository(tx);
      const auditLogs = new SqliteAuditLogRepository(tx, this.requestContext);

      for (const persona of input.personas) {
        personas.save(persona);
      }

      for (const auditLog of input.audit_logs) {
        auditLogs.appendSync(auditLog);
      }
    });
  }
}
