import { requireNonEmptyString, requireOneOf } from "../../../core/validation/guards";

export type WorkspaceStatus = "active" | "suspended" | "closed";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  status: WorkspaceStatus;
  created_at: string;
  updated_at: string;
}

export function normalizeWorkspaceSlug(slug: string): string {
  const normalized = requireNonEmptyString(slug, "slug")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return requireNonEmptyString(normalized, "slug");
}

export function createWorkspace(input: {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}): Workspace {
  const createdAt = requireNonEmptyString(input.created_at, "created_at");

  return {
    id: requireNonEmptyString(input.id, "id"),
    name: requireNonEmptyString(input.name, "name"),
    slug: normalizeWorkspaceSlug(input.slug),
    status: requireOneOf("active", "status", ["active", "suspended", "closed"] as const),
    created_at: createdAt,
    updated_at: createdAt,
  };
}
