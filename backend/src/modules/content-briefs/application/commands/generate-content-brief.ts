import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { AgentRuntimeRepository } from "../../../agent-runtime/application/ports/agent-runtime-repository";
import { createAgentTask } from "../../../agent-runtime/domain/agent-task";
import type { AccountsRepository } from "../../../accounts/application/ports/accounts-repository";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { QueueAccountAutomationTick } from "../../../orchestration/application/commands/queue-account-automation-tick";
import type { PersonasRepository } from "../../../personas/application/ports/personas-repository";
import type { SourcesRepository } from "../../../sources/application/ports/sources-repository";
import type { ContentBriefsRepository } from "../ports/content-briefs-repository";
import { completeContentBrief, createContentBrief, startContentBrief, type ContentBriefGenerationMode } from "../../domain/content-brief";
import { createContentBriefEvidenceItem } from "../../domain/content-brief-evidence-item";
import type { AutopostAutomationContext } from "../../../autopost/domain/autopost-automation-context";
import {
  createAccountActiveSourcesContentBriefSourceScope,
  createSelectedDocumentsContentBriefSourceScope,
  serializeContentBriefSourceScope,
} from "../../domain/content-brief-source-scope";
import type { GenerateContentBriefResponse, GenerateContentBriefSourceScopeRequest } from "../../../../contracts/api/content-briefs";
import { buildDeterministicContentBrief } from "../deterministic-content-brief";

export interface GenerateContentBriefDependencies {
  runtime: AgentRuntimeRepository;
  accounts: AccountsRepository;
  contentBriefs: ContentBriefsRepository;
  personas: PersonasRepository;
  sources: SourcesRepository;
  auditLogs: AuditLogRepository;
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
  }): Promise<GenerateContentBriefResponse> {
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

    const queuedBrief = createContentBrief({
      id: briefId,
      workspace_id: account.workspace_id,
      account_id: account.id,
      trend_id: input.trend_id,
      generation_mode: generationMode,
      topic_hint: initialTopicHint,
      source_scope: sourceScope,
      created_at: now,
      updated_at: now,
    });

    if (generationMode === "from_documents") {
      const fastBrief = await this.buildFastSelectedDocumentsBrief(queuedBrief, {
        source_document_ids: input.source_document_ids ?? [],
        requestedAudience,
        requestedAngleHint,
      });
      await this.deps.contentBriefs.saveBrief(fastBrief.brief);
      await this.deps.contentBriefs.replaceEvidenceItems(fastBrief.brief.id, fastBrief.evidenceItems);
      await this.deps.auditLogs.append({
        id: newId(),
        workspace_id: account.workspace_id,
        actor_type: "user",
        entity_type: "content_brief",
        entity_id: fastBrief.brief.id,
        action: "content_brief.generated",
        after_state: JSON.stringify(fastBrief.brief),
        created_at: now,
      });
      await this.deps.queueAccountAutomationTick.execute({
        account_id: account.id,
        trigger_kind: "system",
        create_if_missing: true,
      });

      return {
        task_id: "",
        status: "succeeded" as const,
        brief_id: fastBrief.brief.id,
      };
    }

    await this.deps.contentBriefs.saveBrief(queuedBrief);

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

  private async buildFastSelectedDocumentsBrief(
    brief: ReturnType<typeof createContentBrief>,
    input: {
      source_document_ids: string[];
      requestedAudience?: string;
      requestedAngleHint?: string;
    },
  ) {
    const accountSources = await this.deps.sources.listSourcesByAccountId(brief.account_id);
    const allowedSourceIds = new Set(accountSources.map((source) => source.id));
    const documents = await this.deps.sources.listDocumentsByIds(input.source_document_ids);
    const selected = documents.filter((document) => allowedSourceIds.has(document.source_id));

    if (selected.length !== input.source_document_ids.length) {
      throw new AppError("VALIDATION_ERROR", "source_document_ids must all resolve to documents owned by the target account", {
        details: {
          account_id: brief.account_id,
          requested_count: input.source_document_ids.length,
          resolved_count: selected.length,
        },
      });
    }

    const persona = await this.deps.personas.findByAccountId(brief.account_id);
    const normalizedDocuments = selected.map((document) => ({
      source_document_id: document.id,
      title: normalizeBriefDocumentTitle(document.title, document.summary, document.body_text, document.canonical_url),
      summary: normalizeBriefDocumentSummary(document.summary, document.body_text, document.title),
      canonical_url: document.canonical_url,
      published_at: document.published_at,
    }));
    const deterministic = buildDeterministicContentBrief({
      topic_hint: brief.topic_hint,
      angle_hint: input.requestedAngleHint,
      audience: input.requestedAudience,
      documents: normalizedDocuments,
      persona: {
        writing_style: persona?.writing_style,
        bio: persona?.bio,
        interests: persona?.interests ?? [],
        personality_traits: persona?.personality_traits,
      },
    });
    const runningBrief = startContentBrief(brief, brief.updated_at, `system:selected_documents_fast_path:${brief.id}`);
    const completedBrief = completeContentBrief(runningBrief, {
      topic: deterministic.topic,
      angle: deterministic.angle,
      audience: deterministic.audience,
      outline: deterministic.outline,
      updated_at: this.deps.now(),
    });

    return {
      brief: completedBrief,
      evidenceItems: deterministic.evidence_items.map((item, index) => createContentBriefEvidenceItem({
        id: newId(),
        brief_id: completedBrief.id,
        source_document_id: item.source_document_id,
        rank: index + 1,
        usage_reason: item.usage_reason,
        key_claims: item.key_claims,
        quoted_excerpt: item.quoted_excerpt,
        created_at: this.deps.now(),
      })),
    };
  }
}

function normalizeBriefDocumentSummary(summary: string, bodyText: string, title: string) {
  const normalizedSummary = summary.trim();
  if (normalizedSummary !== "") {
    return normalizedSummary;
  }

  const fallback = bodyText.trim() || title.trim();
  return fallback.slice(0, 280);
}

function normalizeBriefDocumentTitle(title: string, summary: string, bodyText: string, canonicalUrl: string) {
  const normalizedTitle = title.trim();
  if (normalizedTitle !== "") {
    return normalizedTitle;
  }

  const fallbackText = summary.trim() || bodyText.trim();
  if (fallbackText !== "") {
    return fallbackText.slice(0, 120);
  }

  try {
    const url = new URL(canonicalUrl);
    const path = url.pathname.replace(/^\/+/, "").trim();
    return (path !== "" ? `${url.hostname}/${path}` : url.hostname).slice(0, 120);
  } catch {
    return canonicalUrl.trim().slice(0, 120) || "Untitled source";
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
