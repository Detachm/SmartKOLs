import { AppError } from "../../../../core/errors/app-error";
import type { PersonasRepository } from "../ports/personas-repository";

export interface GetPersonaDependencies {
  personas: PersonasRepository;
}

export class GetPersona {
  constructor(private readonly deps: GetPersonaDependencies) {}

  async execute(accountId: string) {
    const persona = await this.deps.personas.findByAccountId(accountId);
    if (!persona) {
      throw new AppError("NOT_FOUND", "persona not found", {
        details: { account_id: accountId },
      });
    }

    return { persona };
  }
}
