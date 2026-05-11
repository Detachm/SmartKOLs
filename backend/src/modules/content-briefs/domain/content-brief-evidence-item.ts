import { AppError } from "../../../core/errors/app-error";
import { requireIntegerInRange, requireNonEmptyString } from "../../../core/validation/guards";

export interface ContentBriefEvidenceItem {
  id: string;
  brief_id: string;
  source_document_id: string;
  rank: number;
  usage_reason: string;
  key_claims: string[];
  quoted_excerpt?: string;
  created_at: string;
}

export function createContentBriefEvidenceItem(input: ContentBriefEvidenceItem): ContentBriefEvidenceItem {
  return {
    id: requireNonEmptyString(input.id, "id"),
    brief_id: requireNonEmptyString(input.brief_id, "brief_id"),
    source_document_id: requireNonEmptyString(input.source_document_id, "source_document_id"),
    rank: requireIntegerInRange(input.rank, "rank", 1, 1000),
    usage_reason: requireNonEmptyString(input.usage_reason, "usage_reason"),
    key_claims: requireNonEmptyStringArray(input.key_claims, "key_claims"),
    quoted_excerpt: optionalString(input.quoted_excerpt),
    created_at: requireNonEmptyString(input.created_at, "created_at"),
  };
}

function requireNonEmptyStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new AppError("VALIDATION_ERROR", `${field} must be a non-empty string array`, {
      details: { field },
    });
  }

  return value.map((item, index) => requireNonEmptyString(item, `${field}[${index}]`));
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}
