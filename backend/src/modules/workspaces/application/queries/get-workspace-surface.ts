import { requireNonEmptyString } from "../../../../core/validation/guards";
import type { WorkspaceSurfaceResponse } from "../../../../contracts/api/workspace-surface";

export interface WorkspaceSurfaceReadModel {
  getWorkspaceSurface(workspaceId: string): Promise<WorkspaceSurfaceResponse>;
}

export interface GetWorkspaceSurfaceDependencies {
  readModel: WorkspaceSurfaceReadModel;
}

export class GetWorkspaceSurface {
  constructor(private readonly deps: GetWorkspaceSurfaceDependencies) {}

  async execute(workspaceId: string): Promise<WorkspaceSurfaceResponse> {
    return this.deps.readModel.getWorkspaceSurface(requireNonEmptyString(workspaceId, "workspace_id"));
  }
}
