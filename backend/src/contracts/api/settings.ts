import type { Workspace } from "../../modules/workspaces/domain/workspace";
import type { WorkspaceRoleCode } from "../../modules/workspaces/domain/workspace-member";
import type { User } from "../../modules/users/domain/user";

export interface WorkspaceSettingsMemberItem {
  user: User;
  membership: {
    workspace_id: string;
    user_id: string;
    role_code: WorkspaceRoleCode;
    joined_at: string;
  };
}

export interface WorkspaceSettingsOverviewResponse {
  workspace: Workspace;
  members: WorkspaceSettingsMemberItem[];
  summary: {
    member_count: number;
    owner_count: number;
    admin_count: number;
    editor_count: number;
    viewer_count: number;
  };
}

export interface UpdateWorkspaceRequest {
  name: string;
  slug: string;
}

export interface AddWorkspaceMemberRequest {
  email: string;
  name: string;
  role_code: WorkspaceRoleCode;
}

export interface UpdateWorkspaceMemberRoleRequest {
  role_code: WorkspaceRoleCode;
}
