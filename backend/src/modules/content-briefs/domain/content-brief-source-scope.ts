import { AppError } from "../../../core/errors/app-error";
import {
  requireIntegerInRange,
  requireIsoDateTimeString,
  requireOneOf,
} from "../../../core/validation/guards";
import type { SourceType } from "../../sources/domain/source";

export const DEFAULT_CONTENT_BRIEF_SOURCE_SCOPE_LIMIT = 40;
const SOURCE_TYPE_CHOICES = ["rss", "website", "twitter", "youtube", "substack", "telegram"] as const;

export interface AccountActiveSourcesContentBriefSourceScope {
  kind: "account_active_sources";
  source_ids: string[];
  source_types: SourceType[];
  preferred_source_ids: string[];
  preferred_source_types: SourceType[];
  query?: string;
  published_from?: string;
  published_to?: string;
  limit: number;
  requested_audience?: string;
  requested_angle_hint?: string;
}

export interface SelectedDocumentsContentBriefSourceScope {
  kind: "selected_documents";
  source_document_ids: string[];
  requested_audience?: string;
  requested_angle_hint?: string;
}

export type ContentBriefSourceScope =
  | AccountActiveSourcesContentBriefSourceScope
  | SelectedDocumentsContentBriefSourceScope;

export function createAccountActiveSourcesContentBriefSourceScope(input: {
  source_ids?: string[];
  source_types?: SourceType[];
  preferred_source_ids?: string[];
  preferred_source_types?: SourceType[];
  query?: string;
  published_from?: string;
  published_to?: string;
  limit?: number;
  requested_audience?: string;
  requested_angle_hint?: string;
}): AccountActiveSourcesContentBriefSourceScope {
  const publishedFrom = optionalIsoDateTimeString(input.published_from, "published_from");
  const publishedTo = optionalIsoDateTimeString(input.published_to, "published_to");
  if (publishedFrom && publishedTo && Date.parse(publishedFrom) > Date.parse(publishedTo)) {
    throw new AppError("VALIDATION_ERROR", "published_from must be earlier than or equal to published_to", {
      details: { published_from: publishedFrom, published_to: publishedTo },
    });
  }

  return {
    kind: "account_active_sources",
    source_ids: normalizeStringArray(input.source_ids ?? []),
    source_types: normalizeSourceTypes(input.source_types ?? [], "source_types"),
    preferred_source_ids: normalizeStringArray(input.preferred_source_ids ?? []),
    preferred_source_types: normalizeSourceTypes(input.preferred_source_types ?? [], "preferred_source_types"),
    query: optionalString(input.query),
    published_from: publishedFrom,
    published_to: publishedTo,
    limit: input.limit === undefined
      ? DEFAULT_CONTENT_BRIEF_SOURCE_SCOPE_LIMIT
      : requireIntegerInRange(input.limit, "limit", 1, 120),
    requested_audience: optionalString(input.requested_audience),
    requested_angle_hint: optionalString(input.requested_angle_hint),
  };
}

export function createSelectedDocumentsContentBriefSourceScope(input: {
  source_document_ids: string[];
  requested_audience?: string;
  requested_angle_hint?: string;
}): SelectedDocumentsContentBriefSourceScope {
  return {
    kind: "selected_documents",
    source_document_ids: normalizeStringArray(input.source_document_ids),
    requested_audience: optionalString(input.requested_audience),
    requested_angle_hint: optionalString(input.requested_angle_hint),
  };
}

export function serializeContentBriefSourceScope(scope: ContentBriefSourceScope): string {
  if (scope.kind === "account_active_sources") {
    return JSON.stringify({
      kind: scope.kind,
      source_ids: normalizeStringArray(scope.source_ids),
      source_types: normalizeSourceTypes(scope.source_types, "source_types"),
      preferred_source_ids: normalizeStringArray(scope.preferred_source_ids),
      preferred_source_types: normalizeSourceTypes(scope.preferred_source_types, "preferred_source_types"),
      query: optionalString(scope.query),
      published_from: optionalString(scope.published_from),
      published_to: optionalString(scope.published_to),
      limit: scope.limit,
      requested_audience: optionalString(scope.requested_audience),
      requested_angle_hint: optionalString(scope.requested_angle_hint),
    });
  }

  return JSON.stringify({
    kind: scope.kind,
    source_document_ids: normalizeStringArray(scope.source_document_ids),
    requested_audience: optionalString(scope.requested_audience),
    requested_angle_hint: optionalString(scope.requested_angle_hint),
  });
}

export function parseContentBriefSourceScope(value?: string): ContentBriefSourceScope | undefined {
  if (!value || value.trim() === "") {
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (cause) {
    throw new AppError("INVALID_STATE", "content brief source_scope is not valid JSON", {
      cause,
      details: { source_scope: value },
    });
  }

  return parseContentBriefSourceScopeValue(parsed);
}

export function parseContentBriefSourceScopeValue(value: unknown): ContentBriefSourceScope {
  if (!value || typeof value !== "object") {
    throw new AppError("INVALID_STATE", "content brief source_scope must be an object", {
      details: { source_scope: value },
    });
  }

  const raw = value as {
    kind?: unknown;
    source_id?: unknown;
    source_ids?: unknown;
    source_type?: unknown;
    source_types?: unknown;
    preferred_source_ids?: unknown;
    preferred_source_types?: unknown;
    query?: unknown;
    published_from?: unknown;
    published_to?: unknown;
    limit?: unknown;
    source_document_ids?: unknown;
    requested_audience?: unknown;
    requested_angle_hint?: unknown;
  };

  if (raw.kind === "account_active_sources") {
    return createAccountActiveSourcesContentBriefSourceScope({
      source_ids: normalizeLegacyStringArray(raw.source_ids, raw.source_id),
      source_types: normalizeLegacySourceTypeArray(raw.source_types, raw.source_type),
      preferred_source_ids: Array.isArray(raw.preferred_source_ids)
        ? raw.preferred_source_ids.filter((item): item is string => typeof item === "string")
        : [],
      preferred_source_types: Array.isArray(raw.preferred_source_types)
        ? raw.preferred_source_types.filter((item): item is SourceType => typeof item === "string" && SOURCE_TYPE_CHOICES.includes(item as SourceType))
        : [],
      query: typeof raw.query === "string" ? raw.query : undefined,
      published_from: typeof raw.published_from === "string" ? raw.published_from : undefined,
      published_to: typeof raw.published_to === "string" ? raw.published_to : undefined,
      limit: typeof raw.limit === "number" ? raw.limit : undefined,
      requested_audience: typeof raw.requested_audience === "string" ? raw.requested_audience : undefined,
      requested_angle_hint: typeof raw.requested_angle_hint === "string" ? raw.requested_angle_hint : undefined,
    });
  }

  if (raw.kind === "selected_documents") {
    return createSelectedDocumentsContentBriefSourceScope({
      source_document_ids: Array.isArray(raw.source_document_ids)
        ? raw.source_document_ids.filter((item): item is string => typeof item === "string")
        : [],
      requested_audience: typeof raw.requested_audience === "string" ? raw.requested_audience : undefined,
      requested_angle_hint: typeof raw.requested_angle_hint === "string" ? raw.requested_angle_hint : undefined,
    });
  }

  throw new AppError("INVALID_STATE", "content brief source_scope.kind is not supported", {
    details: { kind: raw.kind },
  });
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function optionalIsoDateTimeString(value: unknown, field: string): string | undefined {
  const normalized = optionalString(value);
  return normalized ? requireIsoDateTimeString(normalized, field) : undefined;
}

function normalizeStringArray(values: string[]): string[] {
  return Array.from(new Set(values.map((item) => item.trim()).filter((item) => item !== "")));
}

function normalizeSourceTypes(values: SourceType[], field: string): SourceType[] {
  return Array.from(new Set(values.map((item) => requireOneOf(item, field, SOURCE_TYPE_CHOICES))));
}

function normalizeLegacyStringArray(primary: unknown, fallback: unknown): string[] {
  if (Array.isArray(primary)) {
    return primary.filter((item): item is string => typeof item === "string");
  }

  if (typeof fallback === "string" && fallback.trim() !== "") {
    return [fallback.trim()];
  }

  return [];
}

function normalizeLegacySourceTypeArray(primary: unknown, fallback: unknown): SourceType[] {
  if (Array.isArray(primary)) {
    return primary.filter((item): item is SourceType => typeof item === "string" && SOURCE_TYPE_CHOICES.includes(item as SourceType));
  }

  if (typeof fallback === "string" && SOURCE_TYPE_CHOICES.includes(fallback as SourceType)) {
    return [fallback as SourceType];
  }

  return [];
}
