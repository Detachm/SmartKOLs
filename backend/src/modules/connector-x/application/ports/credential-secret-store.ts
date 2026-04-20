export interface OAuth1CredentialSecret {
  access_token: string;
  access_token_secret: string;
}

export interface OAuth2CredentialSecret {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_at: string;
  refreshed_at: string;
  scope?: string;
}

export interface ApiKeyCredentialSecret {
  bearer_token: string;
}

export interface CredentialSecretStore {
  readOAuth1Secret(secretRef: string): Promise<OAuth1CredentialSecret>;
  readOAuth2Secret(secretRef: string): Promise<OAuth2CredentialSecret>;
  readApiKeySecret(secretRef: string): Promise<ApiKeyCredentialSecret>;
  upsertOAuth2Secret(existingSecretRef: string | undefined, secret: OAuth2CredentialSecret): Promise<string>;
  deleteManagedSecret(secretRef: string | undefined): Promise<void>;
}
