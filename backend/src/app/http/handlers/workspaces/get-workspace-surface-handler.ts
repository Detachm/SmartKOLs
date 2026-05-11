import { ok } from "../../../../core/result/result";
import type { GetWorkspaceSurface } from "../../../../modules/workspaces/application/queries/get-workspace-surface";

export async function getWorkspaceSurfaceHandler(query: GetWorkspaceSurface, workspaceId: string) {
  return ok(await query.execute(workspaceId));
}
