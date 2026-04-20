import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { AgentRuntimeRepository } from "../../../agent-runtime/application/ports/agent-runtime-repository";
import { createAgentTask } from "../../../agent-runtime/domain/agent-task";
import type { AccountsRepository } from "../../../accounts/application/ports/accounts-repository";
import type { QueueAccountAutomationTick } from "../../../orchestration/application/commands/queue-account-automation-tick";
import type { ContentBriefsRepository } from "../ports/content-briefs-repository";
import { createContentBrief, type ContentBriefGenerationMode } from "../../domain/content-brief";
import type { AutopostAutomationContext } from "../../../autopost/domain/autopost-automation-context";
import {
  createAccountActiveSourcesContentBriefSourceScope,
  createSelectedDocumentsContentBriefSourceScope,
  serializeContentBriefSourceScope,
} from "../../domain/content-brief-source-scope";
import type { GenerateContentBriefSourceScopeRequest } from "../../../../contracts/api/content-briefs";

export interface GenerateContentBriefDependencies {
  runtime: AgentRuntimeRepository;
  accounts: AccountsRepository;
  contentBriefs: ContentBriefsRepository;
  queueAccountAutomationTick: QueueAccountAutomationTick;
  now: () => string;
}

export class GenerateContentBrief {
  constructor(private readonly deps: GenerateContentBriefDependencies) {}

  async execute(input: {
    account_id: string;
    trend_id?: string;
    source_document_ids?: string[];
    source_scope?: GenerateContentBriefSourceScopeRequest;
    automation?: AutopostAutomationContext;
    topic_hint?: string;
    audience?: string;
    angle_hint?: string;
  }) {
    const account = await this.deps.accounts.findById(input.account_id);
    if (!account) {
      throw new AppError("NOT_FOUND", "account not found", {
        details: { account_id: input.account_id },
      });
    }

    const hasTrendId = typeof input.trend_id === "string" && input.trend_id.trim() !== "";
    const hasSourceDocumentIds = Array.isArray(input.source_document_ids) && input.source_document_ids.length > 0;
    const hasSourceScope = input.source_scope !== undefined;
    const requestedModes = [hasTrendId || hasSourceScope, hasSourceDocumentIds].filter(Boolean).length;

    if (requestedModes > 1 || (hasSourceDocumentIds && hasSourceScope)) {
      throw new AppError("VALIDATION_ERROR", "brief request must choose either source_document_ids or account_active_sources scope, with optional trend_id only for trend mode", {
        details: { account_id: input.account_id },
      });
    }

    if (requestedModes === 0) {
      throw new AppError("VALIDATION_ERROR", "from_source_scope brief requests must provide source_scope explicitly", {
        details: { account_id: input.account_id },
      });
    }

    const definition = await this.deps.runtime.findDefinitionByCode("brief-builder");
    if (!definition) {
      throw new AppError("NOT_FOUND", "agent definition brief-builder not found", {
        details: { code: "brief-builder" },
      });
    }

    const now = this.deps.now();
    const briefId = newId();
    const generationMode = resolveGenerationMode(input);
    const topicHint = typeof input.topic_hint === "string" ? input.topic_hint.trim() : "";
    const initialTopicHint = topicHint || undefined;
    const requestedAudience = input.audience?.trim() || undefined;
    const requestedAngleHint = input.angle_hint?.trim() || undefined;
    const sourceScope = serializeContentBriefSourceScope(resolveSourceScope({
      generation_mode: generationMode,
      source_document_ids: input.source_document_ids,
      source_scope: input.source_scope,
      requested_audience: requestedAudience,
      requested_angle_hint: requestedAngleHint,
    }));

    await this.deps.contentBriefs.saveBrief(createContentBrief({
      id: briefId,
      workspace_id: account.workspace_id,
      account_id: account.id,
      trend_id: input.trend_id,
      generation_mode: generationMode,
      topic_hint: initialTopicHint,
      source_scope: sourceScope,
      created_at: now,
      updated_at: now,
    }));

    const task = createAgentTask({
      id: newId(),
      workspace_id: account.workspace_id,
      agent_definition_id: definition.id,
      task_type: "content_brief.generate",
      target_type: "account",
      target_id: account.id,
      payload: JSON.stringify({
        brief_id: briefId,
        automation: input.automation,
      }),
      created_at: now,
    });
    await this.deps.runtime.createTask(task);
    await this.deps.queueAccountAutomationTick.execute({
      account_id: account.id,
      trigger_kind: "system",
      create_if_missing: true,
    });

    return {
      task_id: task.id,
      status: task.status,
      brief_id: briefId,
    };
  }
}

function resolveGenerationMode(input: {
  trend_id?: string;
  source_document_ids?: string[];
  source_scope?: GenerateContentBriefSourceScopeRequest;
}): ContentBriefGenerationMode {
  if (typeof input.trend_id === "string" && input.trend_id.trim() !== "") {
    return "from_trend";
  }

  if (input.source_document_ids && input.source_document_ids.length > 0) {
    return "from_documents";
  }

  return "from_source_scope";
}

function resolveSourceScope(input: {
  generation_mode: ContentBriefGenerationMode;
  source_document_ids?: string[];
  source_scope?: GenerateContentBriefSourceScopeRequest;
  requested_audience?: string;
  requested_angle_hint?: string;
}) {
  if (input.generation_mode === "from_documents") {
    return createSelectedDocumentsContentBriefSourceScope({
      source_document_ids: input.source_document_ids ?? [],
      requested_audience: input.requested_audience,
      requested_angle_hint: input.requested_angle_hint,
    });
  }

  if (input.generation_mode === "from_source_scope") {
    if (!input.source_scope || input.source_scope.kind !== "account_active_sources") {
      throw new AppError("VALIDATION_ERROR", "from_source_scope brief requests require source_scope.kind=account_active_sources", {
        details: { generation_mode: input.generation_mode },
      });
    }

    return createAccountActiveSourcesContentBriefSourceScope({
      source_ids: input.source_scope.source_ids,
      source_types: input.source_scope.source_types,
      preferred_source_ids: input.source_scope.preferred_source_ids,
      preferred_source_types: input.source_scope.preferred_source_types,
      query: input.source_scope.query,
      published_from: input.source_scope.published_from,
      published_to: input.source_scope.published_to,
      limit: input.source_scope.limit,
      requested_audience: input.requested_audience,
      requested_angle_hint: input.requested_angle_hint,
    });
  }

  if (input.source_scope) {
    if (input.source_scope.kind !== "account_active_sources") {
      throw new AppError("VALIDATION_ERROR", "from_trend brief requests require source_scope.kind=account_active_sources when source_scope is provided", {
        details: { generation_mode: input.generation_mode },
      });
    }

    return createAccountActiveSourcesContentBriefSourceScope({
      source_ids: input.source_scope.source_ids,
      source_types: input.source_scope.source_types,
      preferred_source_ids: input.source_scope.preferred_source_ids,
      preferred_source_types: input.source_scope.preferred_source_types,
      query: input.source_scope.query,
      published_from: input.source_scope.published_from,
      published_to: input.source_scope.published_to,
      limit: input.source_scope.limit,
      requested_audience: input.requested_audience,
      requested_angle_hint: input.requested_angle_hint,
    });
  }

  return createAccountActiveSourcesContentBriefSourceScope({
    requested_audience: input.requested_audience,
    requested_angle_hint: input.requested_angle_hint,
  });
}
