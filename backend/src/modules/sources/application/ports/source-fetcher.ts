import type { Source } from "../../domain/source";

export interface SourceFetcherDocument {
  external_doc_id?: string;
  canonical_url: string;
  title: string;
  summary?: string;
  body_text: string;
  language: string;
  published_at?: string;
}

export interface SourceFetcherResult {
  documents: SourceFetcherDocument[];
  raw_response?: string;
  raw_response_extension?: "txt" | "json" | "xml";
}

export interface SourceFetcher {
  fetch(source: Source): Promise<SourceFetcherResult>;
}
