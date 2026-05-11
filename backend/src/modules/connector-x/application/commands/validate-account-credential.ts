import { AppError } from "../../../../core/errors/app-error";
import type { Clock } from "../../../../core/time/clock";
import { assertCredentialUsable, createAccountCredential, type AccountCredential } from "../../domain/account-credential";
import type { AccountCredentialsRepository } from "../ports/account-credentials-repository";
import type { CredentialValidator } from "../ports/credential-validator";

export interface ValidateAccountCredentialDependencies {
  credentials: AccountCredentialsRepository;
  validator: CredentialValidator;
  clock: Clock;
}

export class ValidateAccountCredential {
  constructor(private readonly deps: ValidateAccountCredentialDependencies) {}

  async execute(accountId: string): Promise<AccountCredential> {
    const credential = await this.deps.credentials.findValidByAccountId(accountId);

    if (!credential) {
      throw new AppError("NOT_FOUND", "valid account credential not found", {
        details: { account_id: accountId },
      });
    }

    assertCredentialUsable(credential);
    const validation = await this.deps.validator.validate({
      provider: credential.provider,
      secret_ref: credential.secret_ref,
    });

    const next = createAccountCredential({
      ...credential,
      last_validated_at: validation.validated_at || this.deps.clock.now().toISOString(),
    });

    await this.deps.credentials.save(next);
    return next;
  }
}
