import { AppError } from "../../../core/errors/app-error";
import { requireNonEmptyString, requireOneOf } from "../../../core/validation/guards";

export type SourceType = "rss" | "website" | "twitter" | "youtube" | "substack" | "telegram";
export type SourceStatus = "active" | "paused" | "error";

export interface Source {
  id: string;
  workspace_id: string;
  account_id: string;
  type: SourceType;
  name: string;
  url: string;
  status: SourceStatus;
  last_fetched_at?: string;
  created_at: string;
}

export function createSource(source: Source): Source {
  return {
    id: requireNonEmptyString(source.id, "id"),
    workspace_id: requireNonEmptyString(source.workspace_id, "workspace_id"),
    account_id: requireNonEmptyString(source.account_id, "account_id"),
    type: requireOneOf(source.type, "type", ["rss", "website", "twitter", "youtube", "substack", "telegram"] as const),
    name: requireNonEmptyString(source.name, "name"),
    url: requireNonEmptyString(source.url, "url"),
    status: requireOneOf(source.status, "status", ["active", "paused", "error"] as const),
    last_fetched_at: source.last_fetched_at?.trim() || undefined,
    created_at: requireNonEmptyString(source.created_at, "created_at"),
  };
}

export function pauseSource(source: Source): Source {
  if (source.status !== "active") {
    throw new AppError("INVALID_STATE", `source cannot transition from ${source.status} to paused`, {
      details: { source_id: source.id, from: source.status, to: "paused" },
    });
  }

  return createSource({
    ...source,
    status: "paused",
  });
}

export function resumeSource(source: Source): Source {
  if (source.status !== "paused") {
    throw new AppError("INVALID_STATE", `source cannot transition from ${source.status} to active`, {
      details: { source_id: source.id, from: source.status, to: "active" },
    });
  }

  return createSource({
    ...source,
    status: "active",
  });
}
