import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { ApplyPersonaTemplateResponse } from "../../../../contracts/api/persona-templates";
import type { AccountsRepository } from "../../../accounts/application/ports/accounts-repository";
import type { AuditLog } from "../../../audit/domain/audit-log";
import { createOrUpdatePersona } from "../../domain/persona";
import type { PersonasRepository } from "../ports/personas-repository";
import type { PersonaTemplatesRepository } from "../ports/persona-templates-repository";
import type { PersonaTemplateWriteTransaction } from "../ports/persona-template-write-transaction";

export interface ApplyPersonaTemplateDependencies {
  accounts: AccountsRepository;
  personas: PersonasRepository;
  templates: PersonaTemplatesRepository;
  writes: PersonaTemplateWriteTransaction;
  clock: Clock;
}

export class ApplyPersonaTemplate {
  constructor(private readonly deps: ApplyPersonaTemplateDependencies) {}

  async execute(input: {
    template_id: string;
    account_ids: string[];
    actor_id?: string;
  }): Promise<ApplyPersonaTemplateResponse> {
    const requestedIds = Array.from(new Set(input.account_ids.map((accountId) => accountId.trim()).filter(Boolean)));
    if (requestedIds.length === 0) {
      throw new AppError("VALIDATION_ERROR", "account_ids must include at least one account", {
        details: { field: "account_ids" },
      });
    }

    const template = await this.deps.templates.findById(input.template_id);
    if (!template || !template.is_active) {
      throw new AppError("NOT_FOUND", "persona template not found", {
        details: { template_id: input.template_id },
      });
    }

    const accounts = await this.deps.accounts.listByIds(requestedIds);
    if (accounts.length !== requestedIds.length) {
      throw new AppError("VALIDATION_ERROR", "account_ids must all resolve to existing accounts", {
        details: { requested_count: requestedIds.length, resolved_count: accounts.length },
      });
    }

    const workspaceIds = Array.from(new Set(accounts.map((account) => account.workspace_id)));
    if (workspaceIds.length !== 1) {
      throw new AppError("VALIDATION_ERROR", "selected accounts must belong to the same workspace", {
        details: { workspace_ids: workspaceIds },
      });
    }

    const workspaceId = workspaceIds[0];
    if (template.workspace_id && template.workspace_id !== workspaceId) {
      throw new AppError("FORBIDDEN", "workspace template can only be applied inside the same workspace", {
        details: {
          template_id: template.id,
          template_workspace_id: template.workspace_id,
          workspace_id: workspaceId,
        },
      });
    }

    const existingPersonas = await this.deps.personas.listByAccountIds(requestedIds);
    const existingByAccountId = new Map(existingPersonas.map((persona) => [persona.account_id, persona]));
    const now = this.deps.clock.now().toISOString();

    const nextPersonas = accounts.map((account) => {
      const existing = existingByAccountId.get(account.id);
      return createOrUpdatePersona({
        id: existing?.id ?? newId(),
        version: (existing?.version ?? 0) + 1,
        created_at: existing?.created_at ?? now,
        updated_at: now,
        input: {
          workspace_id: account.workspace_id,
          account_id: account.id,
          ...template.persona,
          source: "template",
          actor_type: "user",
          actor_id: input.actor_id,
        },
      });
    });

    const auditLogs: AuditLog[] = nextPersonas.map((persona) => {
      const previous = existingByAccountId.get(persona.account_id);
      return {
        id: newId(),
        workspace_id: persona.workspace_id,
        actor_type: "user",
        actor_id: input.actor_id,
        entity_type: "persona",
        entity_id: persona.id,
        action: previous ? "persona.template_applied" : "persona.created_from_template",
        before_state: previous ? JSON.stringify(previous) : undefined,
        after_state: JSON.stringify({
          template_id: template.id,
          persona,
        }),
        created_at: now,
      };
    });

    await this.deps.writes.commitTemplateApplication({
      personas: nextPersonas,
      audit_logs: auditLogs,
    });

    return {
      template_id: template.id,
      workspace_id: workspaceId,
      applied_count: nextPersonas.length,
    };
  }
}
