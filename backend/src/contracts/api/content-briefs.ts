import type { Trend } from "../../modules/trends/domain/trend";
import type { Source } from "../../modules/sources/domain/source";

export interface ContentBriefAccountActiveSourcesScopeResponse {
  kind: "account_active_sources";
  source_ids: string[];
  source_types: Source["type"][];
  preferred_source_ids: string[];
  preferred_source_types: Source["type"][];
  query?: string;
  published_from?: string;
  published_to?: string;
  limit: number;
  requested_audience?: string;
  requested_angle_hint?: string;
}

export interface ContentBriefSelectedDocumentsScopeResponse {
  kind: "selected_documents";
  source_document_ids: string[];
  requested_audience?: string;
  requested_angle_hint?: string;
}

export type ContentBriefSourceScopeResponse =
  | ContentBriefAccountActiveSourcesScopeResponse
  | ContentBriefSelectedDocumentsScopeResponse;

export interface GenerateContentBriefSourceScopeRequest {
  kind: "account_active_sources";
  source_ids?: string[];
  source_types?: Source["type"][];
  preferred_source_ids?: string[];
  preferred_source_types?: Source["type"][];
  query?: string;
  published_from?: string;
  published_to?: string;
  limit?: number;
}

export interface ContentBriefQualitySummaryResponse {
  evidence_count: number;
  source_count: number;
  source_types: Source["type"][];
  claim_count: number;
  quoted_excerpt_count: number;
  oldest_published_at?: string;
  newest_published_at?: string;
  diversity_status: "single_source" | "multi_source" | "cross_type";
  coverage_status: "thin" | "grounded" | "broad";
}

export interface ContentBriefResponse {
  id: string;
  workspace_id: string;
  account_id: string;
  trend_id?: string;
  status: "queued" | "running" | "ready" | "failed" | "archived";
  generation_mode: "from_trend" | "from_documents" | "from_source_scope";
  topic_hint?: string;
  topic?: string;
  angle?: string;
  audience?: string;
  outline?: string;
  source_scope?: ContentBriefSourceScopeResponse;
  generated_by_run_id?: string;
  error_code?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface ContentBriefEvidenceItemResponse {
  item: {
    id: string;
    brief_id: string;
    source_document_id: string;
    rank: number;
    usage_reason: string;
    key_claims: string[];
    quoted_excerpt?: string;
    created_at: string;
  };
  document: {
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
  };
  source?: {
    id: string;
    account_id: string;
    type: "rss" | "website" | "twitter" | "youtube" | "substack" | "telegram";
    name: string;
    url: string;
    status: "active" | "paused" | "error";
    last_fetched_at?: string;
    created_at: string;
  };
}

export interface ContentBriefListItemResponse {
  brief: ContentBriefResponse;
  trend?: Trend;
  evidence_count: number;
  quality_summary: ContentBriefQualitySummaryResponse;
}

export interface ContentBriefListResponse {
  briefs: ContentBriefListItemResponse[];
}

export interface ContentBriefDetailResponse {
  brief: ContentBriefResponse;
  trend?: Trend;
  evidence: ContentBriefEvidenceItemResponse[];
  quality_summary: ContentBriefQualitySummaryResponse;
}

export interface ContentBriefEvidenceListResponse {
  evidence: ContentBriefEvidenceItemResponse[];
}

export interface GenerateContentBriefRequest {
  trend_id?: string;
  source_document_ids?: string[];
  source_scope?: GenerateContentBriefSourceScopeRequest;
  topic_hint?: string;
  audience?: string;
  angle_hint?: string;
}

export interface GenerateContentBriefResponse {
  task_id: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  brief_id: string;
}
