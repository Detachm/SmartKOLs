import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type {
  RequestDraftRegenerationRequest,
  RequestDraftRegenerationResponse,
} from "../../../../contracts/api/drafts";
import type { AgentRuntimeRepository } from "../../../agent-runtime/application/ports/agent-runtime-repository";
import { createAgentTask } from "../../../agent-runtime/domain/agent-task";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { QueueAccountAutomationTick } from "../../../orchestration/application/commands/queue-account-automation-tick";
import { createDraftReview } from "../../domain/draft";
import type { DraftVersionRepository } from "../ports/draft-version-repository";
import type { DraftsRepository } from "../ports/drafts-repository";

export interface RequestDraftRegenerationDependencies {
  drafts: DraftsRepository;
  versions: DraftVersionRepository;
  runtime: AgentRuntimeRepository;
  auditLogs: AuditLogRepository;
  queueAccountAutomationTick: QueueAccountAutomationTick;
  clock: Clock;
}

export class RequestDraftRegeneration {
  constructor(private readonly deps: RequestDraftRegenerationDependencies) {}

  async execute(draftId: string, input: RequestDraftRegenerationRequest): Promise<RequestDraftRegenerationResponse> {
    const existing = await this.deps.drafts.findById(draftId);
    if (!existing) {
      throw new AppError("NOT_FOUND", "draft not found", {
        details: { draft_id: draftId },
      });
    }

    if (!existing.current_version_id) {
      throw new AppError("INVALID_STATE", "draft current_version_id is required to request regeneration", {
        details: { draft_id: draftId },
      });
    }

    const currentVersion = await this.deps.versions.findById(existing.current_version_id);
    if (!currentVersion) {
      throw new AppError("NOT_FOUND", "draft current version not found", {
        details: { draft_id: draftId, version_id: existing.current_version_id },
      });
    }

    const definition = await this.deps.runtime.findDefinitionByCode("writer");
    if (!definition) {
      throw new AppError("NOT_FOUND", "agent definition writer not found", {
        details: { code: "writer" },
      });
    }

    const metadata = parseDraftVersionMetadata(currentVersion.metadata);
    const contentBriefId = typeof metadata.content_brief_id === "string" ? metadata.content_brief_id.trim() : "";
    if (!contentBriefId) {
      throw new AppError("INVALID_STATE", "draft regeneration requires content_brief_id; legacy topic-only drafts must be rebuilt from a new brief", {
        details: {
          draft_id: draftId,
          version_id: currentVersion.id,
          topic: existing.topic,
        },
      });
    }

    const now = this.deps.clock.now().toISOString();
    const task = createAgentTask({
      id: newId(),
      workspace_id: existing.workspace_id,
      agent_definition_id: definition.id,
      task_type: "draft.generate",
      target_type: "account",
      target_id: existing.account_id,
      payload: JSON.stringify({
        account_id: existing.account_id,
        trend_id: existing.trend_id,
        content_brief_id: contentBriefId,
      }),
      created_at: now,
    });
    const review = createDraftReview({
      id: newId(),
      draft_id: draftId,
      reviewer_type: input.reviewer_type,
      reviewer_id: input.reviewer_id,
      action: "request_regenerate",
      comment: input.comment,
      created_at: now,
    });

    await this.deps.runtime.createTask(task);
    await this.deps.drafts.appendReview(review);
    await this.deps.auditLogs.append({
      id: newId(),
      workspace_id: existing.workspace_id,
      actor_type: input.reviewer_type,
      actor_id: input.reviewer_id,
      entity_type: "draft",
      entity_id: existing.id,
      action: "draft.regenerate_requested",
      before_state: JSON.stringify(existing),
      after_state: JSON.stringify({
        draft_id: existing.id,
        regeneration_task_id: task.id,
        content_brief_id: contentBriefId,
      }),
      created_at: now,
    });
    await this.deps.queueAccountAutomationTick.execute({
      account_id: existing.account_id,
      trigger_kind: "draft_review_follow_up",
      create_if_missing: true,
    });

    return {
      task_id: task.id,
      status: task.status,
    };
  }
}

function parseDraftVersionMetadata(metadata: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(metadata) as unknown;
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // ignore malformed metadata and force the caller onto the explicit brief-backed path
  }

  return {};
}
