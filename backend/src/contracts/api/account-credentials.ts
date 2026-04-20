export type UpsertAccountCredentialRequest =
  | {
      provider: "x_oauth1";
      secret_ref: string;
      status: "valid" | "invalid" | "expired" | "revoked";
    }
  | {
      provider: "api_key";
      secret_ref: string;
      status: "valid" | "invalid" | "expired" | "revoked";
    }
  | {
      provider: "x_oauth2";
      status: "valid" | "invalid" | "expired" | "revoked";
      oauth2_token: {
        access_token: string;
        refresh_token: string;
        token_type: string;
        expires_in: number;
        scope?: string;
      };
    };

export interface AccountCredentialResponse {
  id: string;
  account_id: string;
  provider: "x_oauth1" | "x_oauth2" | "api_key";
  secret_ref: string;
  status: "valid" | "invalid" | "expired" | "revoked";
  last_validated_at?: string;
  created_at: string;
}

export interface CompletePublishJobRequest {
  connector_request_id: string;
  external_post_id?: string;
  external_post_url?: string;
}

export interface FailPublishJobRequest {
  error_code: string;
  error_message: string;
}
