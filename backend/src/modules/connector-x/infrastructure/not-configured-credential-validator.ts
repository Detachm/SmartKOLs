import { AppError } from "../../../core/errors/app-error";
import type { CredentialValidator, CredentialValidationResult } from "../application/ports/credential-validator";

export class NotConfiguredCredentialValidator implements CredentialValidator {
  async validate(): Promise<CredentialValidationResult> {
    throw new AppError("EXTERNAL_DEPENDENCY_ERROR", "twitter credential validator is not configured", {
      details: { dependency: "connector-x.credential-validator" },
    });
  }
}
