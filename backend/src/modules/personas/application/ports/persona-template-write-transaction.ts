import type { AuditLog } from "../../../audit/domain/audit-log";
import type { Persona } from "../../domain/persona";

export interface PersonaTemplateWriteTransaction {
  commitTemplateApplication(input: {
    personas: Persona[];
    audit_logs: AuditLog[];
  }): Promise<void>;
}
