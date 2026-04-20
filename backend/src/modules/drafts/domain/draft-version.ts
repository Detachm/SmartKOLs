import { requireIntegerInRange, requireNonEmptyString, requireOneOf } from "../../../core/validation/guards";

export type DraftVersionCreatorType = "user" | "agent" | "system";

export interface DraftVersion {
  id: string;
  draft_id: string;
  version_no: number;
  content: string;
  metadata: string;
  created_by_type: DraftVersionCreatorType;
  created_by_id?: string;
  created_at: string;
}

export function createDraftVersion(version: DraftVersion): DraftVersion {
  return {
    id: requireNonEmptyString(version.id, "id"),
    draft_id: requireNonEmptyString(version.draft_id, "draft_id"),
    version_no: requireIntegerInRange(version.version_no, "version_no", 1, Number.MAX_SAFE_INTEGER),
    content: requireNonEmptyString(version.content, "content"),
    metadata: requireNonEmptyString(version.metadata, "metadata"),
    created_by_type: requireOneOf(version.created_by_type, "created_by_type", ["user", "agent", "system"] as const),
    created_by_id: version.created_by_id?.trim() || undefined,
    created_at: requireNonEmptyString(version.created_at, "created_at"),
  };
}
