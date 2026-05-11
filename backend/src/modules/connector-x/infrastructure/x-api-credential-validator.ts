import type { CredentialValidationResult, CredentialValidator } from "../application/ports/credential-validator";
import { XApiClient } from "./x-api-client";

export class XApiCredentialValidator implements CredentialValidator {
  constructor(private readonly xApi: XApiClient) {}

  async validate(input: {
    provider: "x_oauth1" | "x_oauth2" | "api_key";
    secret_ref: string;
  }): Promise<CredentialValidationResult> {
    const result = await this.xApi.validateCredential(input);
    return {
      provider_account_id: result.provider_account_id,
      validated_at: result.validated_at,
    };
  }
}
