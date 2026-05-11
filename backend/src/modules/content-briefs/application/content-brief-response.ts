import type { ContentBriefResponse } from "../../../contracts/api/content-briefs";
import { parseContentBriefSourceScope } from "../domain/content-brief-source-scope";

export function mapContentBriefResponse(brief: {
  id: string;
  workspace_id: string;
  account_id: string;
  trend_id?: string | null;
  status: "queued" | "running" | "ready" | "failed" | "archived";
  generation_mode: "from_trend" | "from_documents" | "from_source_scope";
  topic_hint?: string | null;
  topic?: string | null;
  angle?: string | null;
  audience?: string | null;
  outline?: string | null;
  source_scope?: string | null;
  generated_by_run_id?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}): ContentBriefResponse {
  return {
    id: brief.id,
    workspace_id: brief.workspace_id,
    account_id: brief.account_id,
    trend_id: brief.trend_id ?? undefined,
    status: brief.status,
    generation_mode: brief.generation_mode,
    topic_hint: brief.topic_hint ?? undefined,
    topic: brief.topic ?? undefined,
    angle: brief.angle ?? undefined,
    audience: brief.audience ?? undefined,
    outline: brief.outline ?? undefined,
    source_scope: parseContentBriefSourceScope(brief.source_scope ?? undefined),
    generated_by_run_id: brief.generated_by_run_id ?? undefined,
    error_code: brief.error_code ?? undefined,
    error_message: brief.error_message ?? undefined,
    created_at: brief.created_at,
    updated_at: brief.updated_at,
  };
}
