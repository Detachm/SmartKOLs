import type { WorkspaceMember } from "../../domain/workspace-member";

export interface WorkspaceMembersRepository {
  find(workspaceId: string, userId: string): Promise<WorkspaceMember | null>;
  listByWorkspaceId(workspaceId: string): Promise<WorkspaceMember[]>;
  listByUserId(userId: string): Promise<WorkspaceMember[]>;
  save(member: WorkspaceMember): Promise<void>;
  delete(workspaceId: string, userId: string): Promise<void>;
}
