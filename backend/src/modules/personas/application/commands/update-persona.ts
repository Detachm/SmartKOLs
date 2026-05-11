import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import { createOrUpdatePersona, type Persona, type UpdatePersonaInput } from "../../domain/persona";
import type { PersonasRepository } from "../ports/personas-repository";

export interface UpdatePersonaDependencies {
  personas: PersonasRepository;
  auditLogs: AuditLogRepository;
  clock: Clock;
}

export class UpdatePersona {
  constructor(private readonly deps: UpdatePersonaDependencies) {}

  async execute(input: UpdatePersonaInput): Promise<Persona> {
    const existing = await this.deps.personas.findByAccountId(input.account_id);
    const now = this.deps.clock.now().toISOString();
    const persona = createOrUpdatePersona({
      id: existing?.id ?? newId(),
      version: (existing?.version ?? 0) + 1,
      created_at: existing?.created_at ?? now,
      updated_at: now,
      input,
    });

    await this.deps.personas.save(persona);
    await this.deps.auditLogs.append({
      id: newId(),
      workspace_id: persona.workspace_id,
      actor_type: persona.created_by_type,
      actor_id: persona.created_by_id,
      entity_type: "persona",
      entity_id: persona.id,
      action: existing ? "persona.updated" : "persona.created",
      before_state: existing ? JSON.stringify(existing) : undefined,
      after_state: JSON.stringify(persona),
      created_at: now,
    });

    return persona;
  }
}
