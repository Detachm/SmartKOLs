export interface CreateWorkspaceRequest {
  name: string;
  slug: string;
}

export interface WorkspaceResponse {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended" | "closed";
  created_at: string;
  updated_at: string;
}

export interface WorkspaceListResponse {
  workspaces: WorkspaceResponse[];
}
