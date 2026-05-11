import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { WorkspacesRepository } from "../ports/workspaces-repository";
import { normalizeWorkspaceSlug } from "../../domain/workspace";

export interface UpdateWorkspaceDependencies {
  workspaces: WorkspacesRepository;
  auditLogs: AuditLogRepository;
  clock: Clock;
}

export class UpdateWorkspace {
  constructor(private readonly deps: UpdateWorkspaceDependencies) {}

  async execute(input: {
    workspace_id: string;
    name: string;
    slug: string;
  }) {
    const existing = await this.deps.workspaces.findById(input.workspace_id);
    if (!existing) {
      throw new AppError("NOT_FOUND", "workspace not found", {
        details: { workspace_id: input.workspace_id },
      });
    }

    const next = {
      ...existing,
      name: input.name.trim(),
      slug: normalizeWorkspaceSlug(input.slug),
      updated_at: this.deps.clock.now().toISOString(),
    };

    const conflicting = await this.deps.workspaces.findBySlug(next.slug);
    if (conflicting && conflicting.id !== existing.id) {
      throw new AppError("CONFLICT", "workspace slug already exists", {
        details: { slug: next.slug },
      });
    }

    await this.deps.workspaces.save(next);
    await this.deps.auditLogs.append({
      id: newId(),
      workspace_id: next.id,
      actor_type: "user",
      entity_type: "workspace",
      entity_id: next.id,
      action: "workspace.updated",
      before_state: JSON.stringify(existing),
      after_state: JSON.stringify(next),
      created_at: next.updated_at,
    });

    return next;
  }
}
