export interface CredentialValidationResult {
  provider_account_id?: string;
  validated_at: string;
}

export interface CredentialValidator {
  validate(input: {
    provider: "x_oauth1" | "x_oauth2" | "api_key";
    secret_ref: string;
  }): Promise<CredentialValidationResult>;
}
