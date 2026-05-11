import type { Workspace } from "../../domain/workspace";

export interface WorkspacesRepository {
  findById(workspaceId: string): Promise<Workspace | null>;
  findBySlug(slug: string): Promise<Workspace | null>;
  listAll(): Promise<Workspace[]>;
  create(workspace: Workspace): Promise<void>;
  save(workspace: Workspace): Promise<void>;
}
