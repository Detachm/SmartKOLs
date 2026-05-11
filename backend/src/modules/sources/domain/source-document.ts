import { requireNonEmptyString } from "../../../core/validation/guards";

export interface SourceDocument {
  id: string;
  workspace_id: string;
  source_id: string;
  external_doc_id?: string;
  canonical_url: string;
  title: string;
  summary: string;
  body_text: string;
  language: string;
  published_at?: string;
  content_hash: string;
  created_at: string;
}

export function createSourceDocument(document: SourceDocument): SourceDocument {
  return {
    id: requireNonEmptyString(document.id, "id"),
    workspace_id: requireNonEmptyString(document.workspace_id, "workspace_id"),
    source_id: requireNonEmptyString(document.source_id, "source_id"),
    external_doc_id: document.external_doc_id?.trim() || undefined,
    canonical_url: requireNonEmptyString(document.canonical_url, "canonical_url"),
    title: requireNonEmptyString(document.title, "title"),
    summary: document.summary.trim(),
    body_text: requireNonEmptyString(document.body_text, "body_text"),
    language: requireNonEmptyString(document.language, "language"),
    published_at: normalizePublishedAt(document.published_at),
    content_hash: requireNonEmptyString(document.content_hash, "content_hash"),
    created_at: requireNonEmptyString(document.created_at, "created_at"),
  };
}

function normalizePublishedAt(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  const timestamp = Date.parse(trimmed);
  if (!Number.isFinite(timestamp)) {
    return trimmed;
  }

  return new Date(timestamp).toISOString();
}
