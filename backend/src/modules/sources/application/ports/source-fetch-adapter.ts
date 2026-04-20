import type { AccountCredential } from "../../../connector-x/domain/account-credential";
import type { TwitterClient } from "../../../connector-x/application/ports/twitter-client";
import type { Source } from "../../domain/source";

export interface SourceFetchAdapterResult {
  documents: unknown[];
  raw_response?: string;
  raw_response_extension?: "txt" | "json" | "xml";
}

export interface SourceFetchAdapterRuntime {
  getValidCredential(accountId: string): Promise<AccountCredential | null>;
  twitterClient: TwitterClient;
}

export interface SourceFetchAdapter {
  source_type: Source["type"];
  fetch(source: Source, runtime: SourceFetchAdapterRuntime): Promise<SourceFetchAdapterResult>;
}
