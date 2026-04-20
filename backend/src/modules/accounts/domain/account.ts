import { AppError } from "../../../core/errors/app-error";
import { requireNonEmptyString, requireOneOf } from "../../../core/validation/guards";

export type AccountStatus = "active" | "paused" | "disabled" | "error";
export type AccountPlatform = "x";

export interface Account {
  id: string;
  workspace_id: string;
  group_id?: string;
  platform: AccountPlatform;
  handle: string;
  display_name: string;
  avatar_url?: string;
  status: AccountStatus;
  follower_count: number;
  following_count: number;
  post_count: number;
  external_account_id?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateAccountParams {
  id: string;
  workspace_id: string;
  group_id?: string;
  platform: AccountPlatform;
  handle: string;
  display_name: string;
  avatar_url?: string;
  external_account_id?: string;
  created_at: string;
}

export function normalizeHandle(handle: string): string {
  const value = requireNonEmptyString(handle, "handle").replace(/^@+/, "").trim().toLowerCase();
  if (value === "") {
    throw new AppError("VALIDATION_ERROR", "handle cannot be empty after normalization", {
      details: { field: "handle" },
    });
  }

  return `@${value}`;
}

export function createAccount(params: CreateAccountParams): Account {
  const workspaceId = requireNonEmptyString(params.workspace_id, "workspace_id");
  const displayName = requireNonEmptyString(params.display_name, "display_name");
  const platform = requireOneOf(params.platform, "platform", ["x"] as const);
  const createdAt = requireNonEmptyString(params.created_at, "created_at");

  return {
    id: requireNonEmptyString(params.id, "id"),
    workspace_id: workspaceId,
    group_id: params.group_id,
    platform,
    handle: normalizeHandle(params.handle),
    display_name: displayName,
    avatar_url: params.avatar_url?.trim() || undefined,
    status: "active",
    follower_count: 0,
    following_count: 0,
    post_count: 0,
    external_account_id: params.external_account_id?.trim() || undefined,
    created_at: createdAt,
    updated_at: createdAt,
  };
}
