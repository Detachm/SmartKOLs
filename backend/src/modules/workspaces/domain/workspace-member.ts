import { requireNonEmptyString, requireOneOf } from "../../../core/validation/guards";

export type WorkspaceRoleCode = "owner" | "admin" | "editor" | "viewer";

export interface WorkspaceMember {
  workspace_id: string;
  user_id: string;
  role_code: WorkspaceRoleCode;
  joined_at: string;
}

export function createWorkspaceMember(member: WorkspaceMember): WorkspaceMember {
  return {
    workspace_id: requireNonEmptyString(member.workspace_id, "workspace_id"),
    user_id: requireNonEmptyString(member.user_id, "user_id"),
    role_code: requireOneOf(member.role_code, "role_code", ["owner", "admin", "editor", "viewer"] as const),
    joined_at: requireNonEmptyString(member.joined_at, "joined_at"),
  };
}
