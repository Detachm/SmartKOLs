import type { Source } from "../../modules/sources/domain/source";
import type { SourceDocument } from "../../modules/sources/domain/source-document";

export interface AddSourceRequest {
  type: Source["type"];
  name: string;
  url: string;
}

export interface SourceListResponse {
  sources: Source[];
}

export interface IngestSourceDocumentsRequest {
  documents: Array<{
    external_doc_id?: string;
    canonical_url: string;
    title: string;
    summary?: string;
    body_text: string;
    language: string;
    published_at?: string;
  }>;
}

export interface IngestSourceDocumentsResponse {
  imported_count: number;
}

export interface SourceDocumentListResponse {
  documents: SourceDocument[];
}

export interface AccountSourceDocumentListItemResponse {
  document: SourceDocument;
  source: Source;
}

export interface AccountSourceDocumentListResponse {
  documents: AccountSourceDocumentListItemResponse[];
}
