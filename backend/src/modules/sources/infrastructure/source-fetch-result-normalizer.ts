import { AppError } from "../../../core/errors/app-error";
import { validateJsonValue, type JsonSchema } from "../../../core/validation/json-schema";
import type { SourceFetcherDocument } from "../application/ports/source-fetcher";
import type { Source } from "../domain/source";

const RAW_SOURCE_DOCUMENT_SCHEMA: JsonSchema = {
  type: "object",
  required: ["canonical_url", "title", "body_text", "language"],
  properties: {
    source_id: { type: "string" },
    external_doc_id: { type: "string" },
    canonical_url: { type: "string", minLength: 1 },
    title: { type: "string", minLength: 1 },
    summary: { type: "string" },
    body_text: { type: "string", minLength: 1 },
    language: { type: "string", minLength: 1 },
    published_at: { type: "string" },
  },
  additionalProperties: false,
};

export function normalizeSourceFetchDocuments(source: Source, documents: unknown[]): SourceFetcherDocument[] {
  if (!Array.isArray(documents)) {
    throw new AppError("SOURCE_FETCH_INVALID_RESPONSE", "source fetch adapter must return an array of documents", {
      details: { source_id: source.id, source_type: source.type },
    });
  }

  return documents.map((document, index) => normalizeSourceFetchDocument(source, document, index));
}

function normalizeSourceFetchDocument(source: Source, document: unknown, index: number): SourceFetcherDocument {
  const issues = validateJsonValue(document, RAW_SOURCE_DOCUMENT_SCHEMA);
  if (issues.length > 0) {
    throw new AppError("SOURCE_FETCH_SCHEMA_VIOLATION", "source fetch document violates declared schema", {
      details: {
        source_id: source.id,
        source_type: source.type,
        item_index: index,
        issues,
      },
    });
  }

  const record = document as Record<string, unknown>;
  return {
    external_doc_id: optionalString(record.external_doc_id),
    canonical_url: requireString(record.canonical_url, "canonical_url"),
    title: requireString(record.title, "title"),
    summary: optionalString(record.summary),
    body_text: requireString(record.body_text, "body_text"),
    language: requireString(record.language, "language"),
    published_at: optionalString(record.published_at),
  };
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new AppError("SOURCE_FETCH_SCHEMA_VIOLATION", `${field} must be a non-empty string`, {
      details: { field },
    });
  }

  return value.trim();
}
