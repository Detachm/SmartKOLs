import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { CreateWorkspaceRequest, WorkspaceResponse } from "../../../../contracts/api/workspaces";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import { createWorkspace, normalizeWorkspaceSlug } from "../../domain/workspace";
import type { WorkspacesRepository } from "../ports/workspaces-repository";

export interface CreateWorkspaceDependencies {
  workspaces: WorkspacesRepository;
  auditLogs: AuditLogRepository;
  clock: Clock;
}

export class CreateWorkspace {
  constructor(private readonly deps: CreateWorkspaceDependencies) {}

  async execute(input: CreateWorkspaceRequest): Promise<WorkspaceResponse> {
    const slug = normalizeWorkspaceSlug(input.slug);
    const existing = await this.deps.workspaces.findBySlug(slug);

    if (existing) {
      throw new AppError("CONFLICT", "workspace slug already exists", {
        details: { slug },
      });
    }

    const now = this.deps.clock.now().toISOString();
    const workspace = createWorkspace({
      id: newId(),
      name: input.name,
      slug,
      created_at: now,
    });

    await this.deps.workspaces.create(workspace);
    await this.deps.auditLogs.append({
      id: newId(),
      workspace_id: workspace.id,
      actor_type: "system",
      entity_type: "workspace",
      entity_id: workspace.id,
      action: "workspace.created",
      after_state: JSON.stringify(workspace),
      created_at: now,
    });

    return workspace;
  }
}
