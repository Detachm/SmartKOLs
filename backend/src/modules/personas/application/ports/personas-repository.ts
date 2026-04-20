import type { Persona } from "../../domain/persona";

export interface PersonasRepository {
  findByAccountId(accountId: string): Promise<Persona | null>;
  listByAccountIds(accountIds: string[]): Promise<Persona[]>;
  save(persona: Persona): Promise<void>;
}
