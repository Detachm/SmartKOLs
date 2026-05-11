import { AppError } from "../../../core/errors/app-error";
import { requireNonEmptyString, requireOneOf } from "../../../core/validation/guards";

export type ContentBriefStatus = "queued" | "running" | "ready" | "failed" | "archived";
export type ContentBriefGenerationMode = "from_trend" | "from_documents" | "from_source_scope";

export interface ContentBrief {
  id: string;
  workspace_id: string;
  account_id: string;
  trend_id?: string;
  status: ContentBriefStatus;
  generation_mode: ContentBriefGenerationMode;
  topic_hint?: string;
  topic?: string;
  angle?: string;
  audience?: string;
  outline?: string;
  source_scope?: string;
  generated_by_run_id?: string;
  error_code?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export function createContentBrief(input: Omit<ContentBrief, "status">): ContentBrief {
  return {
    id: requireNonEmptyString(input.id, "id"),
    workspace_id: requireNonEmptyString(input.workspace_id, "workspace_id"),
    account_id: requireNonEmptyString(input.account_id, "account_id"),
    trend_id: optionalString(input.trend_id),
    status: "queued",
    generation_mode: requireOneOf(input.generation_mode, "generation_mode", ["from_trend", "from_documents", "from_source_scope"] as const),
    topic_hint: optionalString(input.topic_hint),
    topic: optionalString(input.topic),
    angle: optionalString(input.angle),
    audience: optionalString(input.audience),
    outline: optionalString(input.outline),
    source_scope: optionalString(input.source_scope),
    generated_by_run_id: optionalString(input.generated_by_run_id),
    error_code: optionalString(input.error_code),
    error_message: optionalString(input.error_message),
    created_at: requireNonEmptyString(input.created_at, "created_at"),
    updated_at: requireNonEmptyString(input.updated_at, "updated_at"),
  };
}

export function startContentBrief(brief: ContentBrief, updatedAt: string, generatedByRunId: string): ContentBrief {
  if (brief.status !== "queued") {
    throw new AppError("INVALID_STATE", `content brief cannot transition from ${brief.status} to running`, {
      details: { brief_id: brief.id, from: brief.status, to: "running" },
    });
  }

  return {
    ...brief,
    status: "running",
    generated_by_run_id: requireNonEmptyString(generatedByRunId, "generated_by_run_id"),
    error_code: undefined,
    error_message: undefined,
    updated_at: requireNonEmptyString(updatedAt, "updated_at"),
  };
}

export function completeContentBrief(
  brief: ContentBrief,
  input: {
    topic: string;
    angle: string;
    audience: string;
    outline: string;
    updated_at: string;
  },
): ContentBrief {
  if (brief.status !== "running") {
    throw new AppError("INVALID_STATE", `content brief cannot transition from ${brief.status} to ready`, {
      details: { brief_id: brief.id, from: brief.status, to: "ready" },
    });
  }

  return {
    ...brief,
    status: "ready",
    topic: requireNonEmptyString(input.topic, "topic"),
    angle: requireNonEmptyString(input.angle, "angle"),
    audience: requireNonEmptyString(input.audience, "audience"),
    outline: requireNonEmptyString(input.outline, "outline"),
    error_code: undefined,
    error_message: undefined,
    updated_at: requireNonEmptyString(input.updated_at, "updated_at"),
  };
}

export function failContentBrief(
  brief: ContentBrief,
  input: {
    error_code: string;
    error_message: string;
    updated_at: string;
  },
): ContentBrief {
  if (brief.status !== "queued" && brief.status !== "running") {
    throw new AppError("INVALID_STATE", `content brief cannot transition from ${brief.status} to failed`, {
      details: { brief_id: brief.id, from: brief.status, to: "failed" },
    });
  }

  return {
    ...brief,
    status: "failed",
    error_code: requireNonEmptyString(input.error_code, "error_code"),
    error_message: requireNonEmptyString(input.error_message, "error_message"),
    updated_at: requireNonEmptyString(input.updated_at, "updated_at"),
  };
}

export function requeueContentBrief(brief: ContentBrief, updatedAt: string): ContentBrief {
  if (brief.status !== "ready" && brief.status !== "failed") {
    throw new AppError("INVALID_STATE", `content brief cannot transition from ${brief.status} to queued`, {
      details: { brief_id: brief.id, from: brief.status, to: "queued" },
    });
  }

  return {
    ...brief,
    status: "queued",
    topic: undefined,
    angle: undefined,
    audience: undefined,
    outline: undefined,
    generated_by_run_id: undefined,
    error_code: undefined,
    error_message: undefined,
    updated_at: requireNonEmptyString(updatedAt, "updated_at"),
  };
}

export function archiveContentBrief(brief: ContentBrief, updatedAt: string): ContentBrief {
  if (brief.status !== "queued" && brief.status !== "ready" && brief.status !== "failed") {
    throw new AppError("INVALID_STATE", `content brief cannot transition from ${brief.status} to archived`, {
      details: { brief_id: brief.id, from: brief.status, to: "archived" },
    });
  }

  return {
    ...brief,
    status: "archived",
    updated_at: requireNonEmptyString(updatedAt, "updated_at"),
  };
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}
