import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { GenerateDraftResponse } from "../../../../contracts/api/drafts";
import type { ModelGateway } from "../../../agent-runtime/application/ports/model-gateway";
import type { AccountsRepository } from "../../../accounts/application/ports/accounts-repository";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { ContentBriefsRepository } from "../../../content-briefs/application/ports/content-briefs-repository";
import type { ContentBrief } from "../../../content-briefs/domain/content-brief";
import type { ContentBriefEvidenceItem } from "../../../content-briefs/domain/content-brief-evidence-item";
import type { DraftVersionRepository } from "../ports/draft-version-repository";
import type { DraftsRepository } from "../ports/drafts-repository";
import type { PersonasRepository } from "../../../personas/application/ports/personas-repository";
import type { SourcesRepository } from "../../../sources/application/ports/sources-repository";
import { createDraftVersion } from "../../domain/draft-version";
import type { GenerateDraft } from "./generate-draft";

export interface GenerateDraftFromContentBriefDependencies {
  contentBriefs: ContentBriefsRepository;
  generateDraft: GenerateDraft;
  accounts: AccountsRepository;
  personas: PersonasRepository;
  sources: SourcesRepository;
  drafts: DraftsRepository;
  versions: DraftVersionRepository;
  auditLogs: AuditLogRepository;
  modelGateway: ModelGateway;
  now: () => string;
}

export class GenerateDraftFromContentBrief {
  constructor(private readonly deps: GenerateDraftFromContentBriefDependencies) {}

  async execute(briefId: string, input?: { preview_mode?: boolean }): Promise<GenerateDraftResponse> {
    const brief = await this.deps.contentBriefs.findBriefById(briefId);
    if (!brief) {
      throw new AppError("NOT_FOUND", "content brief not found", {
        details: { brief_id: briefId },
      });
    }

    if (brief.status !== "ready") {
      throw new AppError("INVALID_STATE", "content brief must be ready before draft generation", {
        details: { brief_id: brief.id, status: brief.status },
      });
    }

    const evidence = await this.assertBriefHasEvidence(brief.id);

    if (input?.preview_mode) {
      return this.generatePreviewDraft(brief, evidence);
    }

    return this.deps.generateDraft.execute({
      account_id: brief.account_id,
      trend_id: brief.trend_id,
      content_brief_id: brief.id,
      preview_mode: input?.preview_mode === true,
    });
  }

  private async generatePreviewDraft(brief: ContentBrief, evidence: ContentBriefEvidenceItem[]): Promise<GenerateDraftResponse> {
    const account = await this.deps.accounts.findById(brief.account_id);
    if (!account) {
      throw new AppError("NOT_FOUND", "account not found", {
        details: { account_id: brief.account_id },
      });
    }

    const persona = await this.deps.personas.findByAccountId(account.id);
    if (!persona) {
      throw new AppError("NOT_FOUND", "persona not found", {
        details: { account_id: account.id },
      });
    }

    const documents = await this.deps.sources.listDocumentsByIds(evidence.map((item) => item.source_document_id));
    const documentsById = new Map(documents.map((document) => [document.id, document]));
    const evidenceDocuments = evidence.flatMap((item) => {
      const document = documentsById.get(item.source_document_id);
      if (!document) {
        return [];
      }

      return [{
        source_document_id: document.id,
        title: document.title,
        summary: document.summary,
        canonical_url: document.canonical_url,
        published_at: document.published_at,
      }];
    });
    if (evidenceDocuments.length === 0) {
      throw new AppError("VALIDATION_ERROR", "content brief evidence documents could not be resolved for draft generation", {
        details: {
          brief_id: brief.id,
          evidence_item_count: evidence.length,
        },
      });
    }

    const result = await this.deps.modelGateway.generateDraft({
      account_id: account.id,
      generation_mode: "source_backed",
      topic: brief.topic ?? brief.topic_hint ?? "Current source-backed topic",
      recent_documents: [],
      evidence_documents: evidenceDocuments,
      content_brief: {
        brief_id: brief.id,
        generation_mode: brief.generation_mode,
        topic: brief.topic ?? brief.topic_hint ?? "Current source-backed topic",
        angle: brief.angle ?? "",
        audience: brief.audience ?? "",
        outline: brief.outline ?? "",
      },
      persona: {
        writing_style: persona.writing_style,
        bio: persona.bio,
        interests: persona.interests,
        personality_traits: persona.personality_traits,
        distillation_sample_tweets: persona.distillation_sample_tweets,
      },
    }, { agent_version: "v1" });

    const draftId = newId();
    const createdAt = this.deps.now();
    const version = createDraftVersion({
      id: newId(),
      draft_id: draftId,
      version_no: 1,
      content: result.content,
      metadata: JSON.stringify({
        generation_mode: "source_backed",
        rationale: result.rationale,
        provider_request_id: result.provider_request_id,
        trend_id: brief.trend_id,
        content_brief_id: brief.id,
        preview_mode: true,
        input_kind: "explicit_preview_request",
        agent_run_id: null,
        evidence_document_ids: evidenceDocuments.map((document) => document.source_document_id),
        source_document_ids: evidenceDocuments.map((document) => document.source_document_id),
        citation_urls: evidenceDocuments.map((document) => document.canonical_url),
      }),
      created_by_type: "system",
      created_by_id: "preview_mode",
      created_at: createdAt,
    });

    const draft = {
      id: draftId,
      workspace_id: account.workspace_id,
      account_id: account.id,
      trend_id: brief.trend_id,
      current_version_id: version.id,
      status: "pending" as const,
      topic: result.topic,
      created_at: createdAt,
      updated_at: createdAt,
    };

    await this.deps.drafts.save(draft);
    await this.deps.versions.create(version);
    await this.deps.auditLogs.append({
      id: newId(),
      workspace_id: account.workspace_id,
      actor_type: "system",
      actor_id: "preview_mode",
      entity_type: "draft",
      entity_id: draft.id,
      action: "draft.generated",
      after_state: JSON.stringify(draft),
      created_at: createdAt,
    });

    return {
      task_id: "",
      status: "succeeded",
    };
  }

  private async assertBriefHasEvidence(briefId: string): Promise<ContentBriefEvidenceItem[]> {
    const evidence = await this.deps.contentBriefs.listEvidenceByBriefId(briefId);
    if (evidence.length === 0) {
      throw new AppError("VALIDATION_ERROR", "content brief requires evidence documents before draft generation", {
        details: {
          brief_id: briefId,
          required_evidence_count: 1,
        },
      });
    }

    return evidence;
  }
}
