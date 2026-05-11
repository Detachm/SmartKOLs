import type { WorkspaceRoleCode } from "../../modules/workspaces/domain/workspace-member";
import type { Workspace } from "../../modules/workspaces/domain/workspace";
import type { User } from "../../modules/users/domain/user";

export interface BootstrapLocalAuthRequest {
  workspace_slug: string;
  email: string;
  name: string;
}

export interface SessionContextWorkspace {
  workspace: Workspace;
  role_code: WorkspaceRoleCode;
  joined_at: string;
}

export interface SessionContextResponse {
  user: User;
  workspaces: SessionContextWorkspace[];
}
