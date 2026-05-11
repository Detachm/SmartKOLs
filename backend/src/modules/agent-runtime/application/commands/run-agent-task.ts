import { AppError } from "../../../../core/errors/app-error";
import type { ArtifactStore } from "../../../../core/artifacts/artifact-store";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { AccountsRepository } from "../../../accounts/application/ports/accounts-repository";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { ContentBriefsRepository } from "../../../content-briefs/application/ports/content-briefs-repository";
import {
  completeContentBrief,
  failContentBrief,
  startContentBrief,
} from "../../../content-briefs/domain/content-brief";
import { createContentBriefEvidenceItem } from "../../../content-briefs/domain/content-brief-evidence-item";
import {
  parseContentBriefSourceScope,
  type ContentBriefSourceScope,
} from "../../../content-briefs/domain/content-brief-source-scope";
import type { DraftVersionRepository } from "../../../drafts/application/ports/draft-version-repository";
import type { FailAutopostRun } from "../../../autopost/application/commands/fail-autopost-run";
import type { AutopostRunsRepository } from "../../../autopost/application/ports/autopost-runs-repository";
import {
  assertSourceBackedOriginalityGuardPassed,
  evaluateSourceBackedOriginalityGuard,
} from "../../../drafts/domain/source-backed-originality-guard";
import type { DraftsRepository } from "../../../drafts/application/ports/drafts-repository";
import { createDraftReview } from "../../../drafts/domain/draft";
import { createDraftVersion } from "../../../drafts/domain/draft-version";
import type { EngagementRepository } from "../../../engagement/application/ports/engagement-repository";
import { createReplyProposal } from "../../../engagement/domain/reply-proposal";
import type { PersonasRepository } from "../../../personas/application/ports/personas-repository";
import { createOrUpdatePersona } from "../../../personas/domain/persona";
import type { TrendsRepository } from "../../../trends/application/ports/trends-repository";
import type { SourcesRepository } from "../../../sources/application/ports/sources-repository";
import type { Source } from "../../../sources/domain/source";
import type { AccountSourceDocumentsReadModel } from "../../../sources/application/queries/list-account-source-documents";
import type { AlertsRepository } from "../../../monitoring/application/ports/alerts-repository";
import { createAlert } from "../../../monitoring/domain/alert";
import type { QueueAccountAutomationTick } from "../../../orchestration/application/commands/queue-account-automation-tick";
import type { QueueSendReplyProposalJob } from "../../../execution/application/commands/queue-send-reply-proposal-job";
import type { EngagementPoliciesRepository } from "../../../engagement/application/ports/engagement-policies-repository";
import type { AgentRuntimeRepository } from "../ports/agent-runtime-repository";
import type { ModelGateway } from "../ports/model-gateway";
import { createAgentRun, failAgentRun, succeedAgentRun } from "../../domain/agent-run";
import { failAgentTask, startAgentTaskExecution, succeedAgentTask, type AgentTask } from "../../domain/agent-task";
import { createModelRequest } from "../../domain/model-request";
import { createModelRequestAttempt } from "../../domain/model-request-attempt";
import { createToolCall } from "../../domain/tool-call";
import { isInvalidModelOutputError } from "../../infrastructure/model-error-normalizer";
import { getAgentArtifactBundle, type AgentArtifactBundle } from "../../infrastructure/static-agent-artifacts";

export interface RunAgentTaskDependencies {
  runtime: AgentRuntimeRepository;
  accounts: AccountsRepository;
  contentBriefs: ContentBriefsRepository;
  personas: PersonasRepository;
  trends: TrendsRepository;
  sources: SourcesRepository;
  accountSourceDocuments: AccountSourceDocumentsReadModel;
  drafts: DraftsRepository;
  versions: DraftVersionRepository;
  engagement: EngagementRepository;
  artifactStore: ArtifactStore;
  auditLogs: AuditLogRepository;
  alerts: AlertsRepository;
  autopostRuns: AutopostRunsRepository;
  failAutopostRun: FailAutopostRun;
  queueAccountAutomationTick: QueueAccountAutomationTick;
  queueSendReplyProposalJob: QueueSendReplyProposalJob;
  engagementPolicies: EngagementPoliciesRepository;
  modelGateway: ModelGateway;
  clock: Clock;
}

export class RunAgentTask {
  constructor(private readonly deps: RunAgentTaskDependencies) {}

  async execute(taskId: string, options?: { claimed?: boolean }) {
    const task = await this.deps.runtime.findTaskById(taskId);
    if (!task) {
      throw new AppError("NOT_FOUND", "agent task not found", {
        details: { task_id: taskId },
      });
    }

    const definition = await this.deps.runtime.findDefinitionById(task.agent_definition_id);
    if (!definition || !definition.is_active) {
      throw new AppError("NOT_FOUND", "agent definition not found", {
        details: { agent_definition_id: task.agent_definition_id },
      });
    }

    const now = this.deps.clock.now().toISOString();
    const runningTask = resolveRunningTask(task, options?.claimed, now);
    if (task.status === "queued") {
      await this.deps.runtime.saveTask(runningTask);
    }
    const gatewayDescriptor = this.deps.modelGateway.describe();
    const artifact = this.resolveArtifact(definition.code, definition.version);
    const latestRun = await this.deps.runtime.findLatestRunByTaskId(task.id);

    const run = createAgentRun({
      id: newId(),
      task_id: task.id,
      run_no: (latestRun?.run_no ?? 0) + 1,
      model_name: gatewayDescriptor.model_name,
      started_at: now,
    });
    await this.deps.runtime.createRun(run);

    const modelRequest = createModelRequest({
      id: newId(),
      workspace_id: task.workspace_id,
      agent_run_id: run.id,
      provider: gatewayDescriptor.provider,
      model_name: gatewayDescriptor.model_name,
      request_schema_version: definition.version,
      prompt_artifact_ref: artifact.prompt.ref,
      tool_spec_ref: artifact.tool_policy.ref,
      started_at: now,
    });
    await this.deps.runtime.createModelRequest(modelRequest);

    try {
      const taskOutput = await this.executeTask(definition.code, artifact, {
        task_id: task.id,
        run_id: run.id,
        task,
      });

      const rawResponseRef = await this.persistModelArtifact(modelRequest.id, run.id, taskOutput.output.raw_response);
      await this.deps.runtime.createModelRequestAttempt(createModelRequestAttempt({
        id: newId(),
        model_request_id: modelRequest.id,
        attempt_no: 1,
        provider_request_id: taskOutput.provider_request_id,
        raw_response_ref: rawResponseRef,
        parsed_output: JSON.stringify(stripRawResponse(taskOutput.output as unknown as Record<string, unknown>)),
        started_at: now,
        finished_at: this.deps.clock.now().toISOString(),
      }));
      await this.deps.runtime.saveRun(succeedAgentRun(run, JSON.stringify(taskOutput.output), this.deps.clock.now().toISOString()));
      await this.deps.runtime.saveTask(succeedAgentTask(runningTask, this.deps.clock.now().toISOString()));
      await this.deps.runtime.saveModelRequest({
        ...modelRequest,
        status: "succeeded",
        finished_at: this.deps.clock.now().toISOString(),
      });
      await this.queueContentFollowUpTickIfNeeded(task);

      return {
        task_id: task.id,
        run_id: run.id,
        status: "succeeded" as const,
        ...taskOutput.response,
      };
    } catch (error) {
      const appError = error instanceof AppError
        ? error
        : new AppError("EXTERNAL_DEPENDENCY_ERROR", "agent task execution failed", { cause: error });
      const invalidOutput = isInvalidModelOutputError(appError);
      const cleanupErrors: string[] = [];

      await this.deps.runtime.createModelRequestAttempt(createModelRequestAttempt({
        id: newId(),
        model_request_id: modelRequest.id,
        attempt_no: 1,
        validation_error: invalidOutput ? appError.message : undefined,
        error_code: invalidOutput ? undefined : appError.code,
        error_message: invalidOutput ? undefined : appError.message,
        started_at: now,
        finished_at: this.deps.clock.now().toISOString(),
      }));
      await this.deps.runtime.saveRun(failAgentRun(run, appError.code, appError.message, this.deps.clock.now().toISOString()));
      await this.deps.runtime.saveTask(failAgentTask(
        runningTask,
        this.deps.clock.now().toISOString(),
        appError.code,
        appError.message,
      ));
      await this.deps.runtime.saveModelRequest({
        ...modelRequest,
        status: invalidOutput ? "invalid_output" : "failed",
        finished_at: this.deps.clock.now().toISOString(),
      });
      try {
        await this.failLinkedAutopostRunIfNeeded(task.id, appError.code, appError.message);
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError instanceof Error ? cleanupError.message : "linked autopost cleanup failed");
      }
      await this.deps.alerts.create(createAlert({
        id: newId(),
        workspace_id: task.workspace_id,
        severity: "warning",
        source_type: "runtime",
        source_id: run.id,
        code: "agent.run.failed",
        message: appError.message,
        payload: JSON.stringify({ task_id: task.id, error_code: appError.code }),
        created_at: this.deps.clock.now().toISOString(),
      }));
      if (cleanupErrors.length > 0) {
        throw new AppError("INTERNAL_ERROR", "agent task failed and cleanup was incomplete", {
          details: {
            task_id: task.id,
            original_error_code: appError.code,
            original_error_message: appError.message,
            cleanup_errors: cleanupErrors,
          },
          cause: appError,
        });
      }
      throw appError;
    }
  }

  private async queueContentFollowUpTickIfNeeded(task: {
    target_type: string;
    target_id: string;
    payload: string;
    task_type?: string;
  }) {
    if (task.target_type === "account") {
      if (task.task_type !== "content_brief.generate" && task.task_type !== "draft.generate") {
        return;
      }

      await this.deps.queueAccountAutomationTick.execute({
        account_id: task.target_id,
        trigger_kind: "content_task_follow_up",
        create_if_missing: false,
      });
      return;
    }

    if (task.target_type === "engagement_thread" && task.task_type === "inbox.classify") {
      const payload = parseTaskPayload(task.payload, task.target_id);
      const accountId = typeof payload.account_id === "string" ? payload.account_id.trim() : "";
      if (!accountId) {
        return;
      }

      await this.deps.queueAccountAutomationTick.execute({
        account_id: accountId,
        trigger_kind: "system",
        create_if_missing: false,
      });
    }
  }

  private async failLinkedAutopostRunIfNeeded(taskId: string, errorCode: string, errorMessage: string) {
    const autopostRun = await this.deps.autopostRuns.findActiveByTaskId(taskId);
    if (!autopostRun) {
      return;
    }

    await this.deps.failAutopostRun.execute(autopostRun.id, errorCode, errorMessage);
  }

  private async executeTask(
    definitionCode: string,
    artifact: AgentArtifactBundle,
    input: {
      task_id: string;
      run_id: string;
      task: {
        id: string;
        workspace_id: string;
        target_type: string;
        target_id: string;
        payload: string;
      };
    },
  ) {
    if (definitionCode === "inbox-classifier") {
      if (input.task.target_type !== "engagement_thread") {
        throw new AppError("INVALID_STATE", "inbox-classifier target_type must be engagement_thread", {
          details: { task_id: input.task.id, target_type: input.task.target_type },
        });
      }

      const thread = await this.deps.engagement.findThreadById(input.task.target_id);
      if (!thread) {
        throw new AppError("NOT_FOUND", "engagement thread not found", {
          details: { thread_id: input.task.target_id },
        });
      }

      const messages = await this.deps.engagement.listMessagesByThreadId(thread.id);
      await this.recordToolCall(artifact, input.run_id, "engagement.get_thread_context", {
        thread_id: thread.id,
      }, {
        thread,
        messages: messages.map((message) => ({
          id: message.id,
          direction: message.direction,
          sender_handle: message.sender_handle,
          content: message.content,
          created_at: message.created_at,
        })),
      });

      const result = await this.deps.modelGateway.classifyInboxThread({
        thread_id: thread.id,
        channel: thread.channel,
        messages: messages.map((message) => ({
          sender_handle: message.sender_handle,
          content: message.content,
          created_at: message.created_at,
        })),
      }, { agent_version: artifact.definition.version });

      await this.deps.engagement.saveThread({
        ...thread,
        classification: result.classification,
      });
      await this.deps.auditLogs.append({
        id: newId(),
        workspace_id: thread.workspace_id,
        actor_type: "agent",
        entity_type: "engagement_thread",
        entity_id: thread.id,
        action: "engagement_thread.classified",
        before_state: JSON.stringify(thread),
        after_state: JSON.stringify({ ...thread, classification: result.classification }),
        created_at: this.deps.clock.now().toISOString(),
      });

      return {
        provider_request_id: result.provider_request_id,
        output: result,
        response: {
          classification: result.classification,
        },
      };
    }

    if (definitionCode === "reply-proposer") {
      if (input.task.target_type !== "engagement_thread") {
        throw new AppError("INVALID_STATE", "reply-proposer target_type must be engagement_thread", {
          details: { task_id: input.task.id, target_type: input.task.target_type },
        });
      }

      const thread = await this.deps.engagement.findThreadById(input.task.target_id);
      if (!thread) {
        throw new AppError("NOT_FOUND", "engagement thread not found", {
          details: { thread_id: input.task.target_id },
        });
      }

      const messages = await this.deps.engagement.listMessagesByThreadId(thread.id);
      await this.recordToolCall(artifact, input.run_id, "engagement.get_thread_context", {
        thread_id: thread.id,
      }, {
        thread,
        messages: messages.map((message) => ({
          id: message.id,
          direction: message.direction,
          sender_handle: message.sender_handle,
          content: message.content,
          created_at: message.created_at,
        })),
      });

      const payload = JSON.parse(input.task.payload) as {
        preferred_style?: string;
      };

      const result = await this.deps.modelGateway.proposeReply({
        thread_id: thread.id,
        channel: thread.channel,
        counterpart_handle: thread.counterpart_handle,
        preferred_style: typeof payload.preferred_style === "string" ? payload.preferred_style : undefined,
        messages: messages.map((message) => ({
          sender_handle: message.sender_handle,
          content: message.content,
          created_at: message.created_at,
        })),
      }, { agent_version: artifact.definition.version });

      const proposal = createReplyProposal({
        id: newId(),
        workspace_id: thread.workspace_id,
        account_id: thread.account_id,
        thread_id: thread.id,
        agent_task_id: input.task.id,
        agent_run_id: input.run_id,
        content: result.content,
        rationale: result.rationale,
        created_at: this.deps.clock.now().toISOString(),
      });

      await this.deps.engagement.saveReplyProposal(proposal);
      await this.deps.engagement.saveThread({
        ...thread,
        status: "pending_action",
      });
      await this.deps.auditLogs.append({
        id: newId(),
        workspace_id: thread.workspace_id,
        actor_type: "agent",
        entity_type: "engagement_reply_proposal",
        entity_id: proposal.id,
        action: "engagement_reply_proposal.generated",
        after_state: JSON.stringify(proposal),
        created_at: this.deps.clock.now().toISOString(),
      });
      const policy = await this.deps.engagementPolicies.findByAccountId(thread.account_id);
      if (policy && policy.status === "active" && !policy.policy_body.require_manual_approval) {
        await this.deps.queueSendReplyProposalJob.execute(proposal.id);
      }

      return {
        provider_request_id: result.provider_request_id,
        output: result,
        response: {
          proposal_id: proposal.id,
        },
      };
    }

    if (definitionCode === "brief-builder") {
      if (input.task.target_type !== "account") {
        throw new AppError("INVALID_STATE", "brief-builder target_type must be account", {
          details: { task_id: input.task.id, target_type: input.task.target_type },
        });
      }

      const payload = JSON.parse(input.task.payload) as {
        brief_id?: string;
      };
      const briefId = typeof payload.brief_id === "string" ? payload.brief_id : "";
      if (!briefId) {
        throw new AppError("VALIDATION_ERROR", "brief-builder payload brief_id is required", {
          details: { task_id: input.task.id },
        });
      }

      const brief = await this.deps.contentBriefs.findBriefById(briefId);
      if (!brief) {
        throw new AppError("NOT_FOUND", "content brief not found", {
          details: { brief_id: briefId },
        });
      }

      const account = await this.deps.accounts.findById(input.task.target_id);
      if (!account) {
        throw new AppError("NOT_FOUND", "account not found", {
          details: { account_id: input.task.target_id },
        });
      }

      const persona = await this.deps.personas.findByAccountId(account.id);
      if (!persona) {
        throw new AppError("NOT_FOUND", "persona not found", {
          details: { account_id: account.id },
        });
      }

      await this.recordToolCall(artifact, input.run_id, "personas.get_current", {
        account_id: account.id,
      }, persona);

      const runningBrief = startContentBrief(brief, this.deps.clock.now().toISOString(), input.run_id);
      await this.deps.contentBriefs.saveBrief(runningBrief);

      try {
        const sourceScope = parseContentBriefSourceScope(runningBrief.source_scope);
        if (!sourceScope) {
          throw new AppError("INVALID_STATE", "content brief source_scope is required before brief generation", {
            details: { brief_id: runningBrief.id },
          });
        }

        const trend = runningBrief.trend_id
          ? await this.loadTrendContext(artifact, input.run_id, runningBrief.trend_id)
          : undefined;
        const documents = await this.loadBriefDocuments(artifact, input.run_id, {
          account_id: account.id,
          generation_mode: runningBrief.generation_mode,
          trend_topic: trend?.topic,
          source_scope: sourceScope,
          topic_hint: runningBrief.topic_hint,
        });

        const result = await this.deps.modelGateway.generateContentBrief({
          account_id: account.id,
          generation_mode: runningBrief.generation_mode,
          topic_hint: runningBrief.topic_hint,
          angle_hint: sourceScope.requested_angle_hint,
          audience: sourceScope.requested_audience,
          trend,
          documents,
          persona: {
            writing_style: persona.writing_style,
            bio: persona.bio,
            interests: persona.interests,
            personality_traits: persona.personality_traits,
          },
        }, { agent_version: artifact.definition.version });

        const completedBrief = completeContentBrief(runningBrief, {
          topic: result.topic,
          angle: result.angle,
          audience: result.audience,
          outline: result.outline,
          updated_at: this.deps.clock.now().toISOString(),
        });
        await this.deps.contentBriefs.saveBrief(completedBrief);
        await this.deps.contentBriefs.replaceEvidenceItems(completedBrief.id, result.evidence_items.map((item, index) => createContentBriefEvidenceItem({
          id: newId(),
          brief_id: completedBrief.id,
          source_document_id: item.source_document_id,
          rank: index + 1,
          usage_reason: item.usage_reason,
          key_claims: item.key_claims,
          quoted_excerpt: item.quoted_excerpt,
          created_at: this.deps.clock.now().toISOString(),
        })));
        await this.deps.auditLogs.append({
          id: newId(),
          workspace_id: account.workspace_id,
          actor_type: "agent",
          actor_id: input.run_id,
          entity_type: "content_brief",
          entity_id: completedBrief.id,
          action: "content_brief.generated",
          after_state: JSON.stringify(completedBrief),
          created_at: this.deps.clock.now().toISOString(),
        });

        return {
          provider_request_id: result.provider_request_id,
          output: result,
          response: {
            brief_id: completedBrief.id,
          },
        };
      } catch (error) {
        const appError = error instanceof AppError
          ? error
          : new AppError("EXTERNAL_DEPENDENCY_ERROR", "content brief generation failed", { cause: error });
        await this.deps.contentBriefs.saveBrief(failContentBrief(runningBrief, {
          error_code: appError.code,
          error_message: appError.message,
          updated_at: this.deps.clock.now().toISOString(),
        }));
        throw appError;
      }
    }

    if (definitionCode === "writer") {
      if (input.task.target_type !== "account") {
        throw new AppError("INVALID_STATE", "writer target_type must be account", {
          details: { task_id: input.task.id, target_type: input.task.target_type },
        });
      }

      const payload = JSON.parse(input.task.payload) as {
        account_id?: string;
        topic?: string;
        trend_id?: string;
        content_brief_id?: string;
        preview_mode?: boolean;
      };
      const account = await this.deps.accounts.findById(input.task.target_id);
      if (!account) {
        throw new AppError("NOT_FOUND", "account not found", {
          details: { account_id: input.task.target_id },
        });
      }

      const persona = await this.deps.personas.findByAccountId(account.id);
      if (!persona) {
        throw new AppError("NOT_FOUND", "persona not found", {
          details: { account_id: account.id },
        });
      }

      await this.recordToolCall(artifact, input.run_id, "personas.get_current", {
        account_id: account.id,
      }, persona);

      const briefId = typeof payload.content_brief_id === "string" ? payload.content_brief_id.trim() : "";
      if (!briefId) {
        throw new AppError("VALIDATION_ERROR", "writer task content_brief_id is required", {
          details: { task_id: input.task.id },
        });
      }
      const brief = await this.loadContentBriefContext(artifact, input.run_id, briefId);
      const topic = brief.brief.topic;

      const result = await this.deps.modelGateway.generateDraft({
        account_id: account.id,
        generation_mode: "source_backed",
        topic,
        trend: typeof payload.trend_id === "string"
          ? await this.loadTrendContext(artifact, input.run_id, payload.trend_id)
          : undefined,
        recent_documents: [],
        evidence_documents: brief.evidence_documents,
        content_brief: {
          brief_id: brief.brief.id,
          generation_mode: brief.brief.generation_mode,
          topic: brief.brief.topic,
          angle: brief.brief.angle,
          audience: brief.brief.audience,
          outline: brief.brief.outline,
        },
        persona: {
          writing_style: persona.writing_style,
          bio: persona.bio,
          interests: persona.interests,
          personality_traits: persona.personality_traits,
          distillation_sample_tweets: persona.distillation_sample_tweets,
        },
        }, { agent_version: artifact.definition.version });
      const previewMode = payload.preview_mode === true;
      const originalityGuard = !previewMode
        ? await this.runSourceBackedOriginalityGuard(artifact, input.run_id, {
          account_id: account.id,
          brief_id: brief.brief.id,
          draft_content: result.content,
          evidence_documents: brief.originality_guard_documents,
        })
        : undefined;

      const draftId = newId();
      const createdAt = this.deps.clock.now().toISOString();
      const version = createDraftVersion({
        id: newId(),
        draft_id: draftId,
        version_no: 1,
        content: result.content,
        metadata: JSON.stringify({
          generation_mode: "source_backed",
          rationale: result.rationale,
          provider_request_id: result.provider_request_id,
          agent_run_id: input.run_id,
          trend_id: payload.trend_id,
          content_brief_id: brief.brief.id,
          preview_mode: previewMode || undefined,
          evidence_document_ids: brief.evidence_documents.map((document) => document.source_document_id),
          source_document_ids: brief.evidence_documents.map((document) => document.source_document_id),
          citation_urls: brief.evidence_documents.map((document) => document.canonical_url),
          originality_guard: originalityGuard,
        }),
        created_by_type: "agent",
        created_by_id: input.run_id,
        created_at: createdAt,
      });

      const draft = {
        id: draftId,
        workspace_id: account.workspace_id,
        account_id: account.id,
        trend_id: typeof payload.trend_id === "string" ? payload.trend_id : undefined,
        current_version_id: version.id,
        status: "pending" as const,
        topic: result.topic,
        generated_by_run_id: input.run_id,
        created_at: createdAt,
        updated_at: createdAt,
      };

      await this.deps.drafts.save(draft);
      await this.deps.versions.create(version);
      await this.deps.auditLogs.append({
        id: newId(),
        workspace_id: account.workspace_id,
        actor_type: "agent",
        actor_id: input.run_id,
        entity_type: "draft",
        entity_id: draft.id,
        action: "draft.generated",
        after_state: JSON.stringify(draft),
        created_at: createdAt,
      });

      return {
        provider_request_id: result.provider_request_id,
        output: result,
        response: {
          draft_id: draft.id,
        },
      };
    }

    if (definitionCode === "persona-distiller") {
      if (input.task.target_type !== "account") {
        throw new AppError("INVALID_STATE", "persona-distiller target_type must be account", {
          details: { task_id: input.task.id, target_type: input.task.target_type },
        });
      }

      const payload = JSON.parse(input.task.payload) as {
        account_id?: string;
        samples?: Array<{ kind?: "post" | "reply"; content?: string; canonical_url?: string; created_at?: string }>;
      };
      const account = await this.deps.accounts.findById(input.task.target_id);
      if (!account) {
        throw new AppError("NOT_FOUND", "account not found", {
          details: { account_id: input.task.target_id },
        });
      }

      const existing = await this.deps.personas.findByAccountId(account.id);
      if (existing) {
        await this.recordToolCall(artifact, input.run_id, "personas.get_current", {
          account_id: account.id,
        }, existing);
      }

      const samples = Array.isArray(payload.samples)
        ? payload.samples
          .map((sample) => ({
            kind: sample.kind === "reply" ? "reply" as const : "post" as const,
            content: typeof sample.content === "string" ? sample.content.trim() : "",
            canonical_url: typeof sample.canonical_url === "string" ? sample.canonical_url.trim() || undefined : undefined,
            created_at: typeof sample.created_at === "string" ? sample.created_at.trim() || undefined : undefined,
          }))
          .filter((sample) => sample.content !== "")
        : [];
      if (samples.length === 0) {
        throw new AppError("VALIDATION_ERROR", "persona distillation samples are required", {
          details: { task_id: input.task.id },
        });
      }

      await this.recordToolCall(artifact, input.run_id, "sources.get_distillation_samples", {
        account_id: account.id,
        sample_count: samples.length,
      }, { samples });

      const result = await this.deps.modelGateway.distillPersona({
        account_id: account.id,
        samples,
      }, { agent_version: artifact.definition.version });

      const now = this.deps.clock.now().toISOString();
      const persona = createOrUpdatePersona({
        id: existing?.id ?? newId(),
        version: (existing?.version ?? 0) + 1,
        created_at: existing?.created_at ?? now,
        updated_at: now,
        input: {
          workspace_id: account.workspace_id,
          account_id: account.id,
          gender: result.gender,
          nationality: result.nationality,
          age: result.age,
          interests: result.interests,
          personality_traits: result.personality_traits,
          writing_style: result.writing_style,
          bio: result.bio,
          distillation_sample_tweets: result.distillation_sample_tweets,
          source: "distilled",
          actor_type: "agent",
          actor_id: input.run_id,
        },
      });

      await this.deps.personas.save(persona);
      await this.deps.auditLogs.append({
        id: newId(),
        workspace_id: account.workspace_id,
        actor_type: "agent",
        actor_id: input.run_id,
        entity_type: "persona",
        entity_id: persona.id,
        action: "persona.distilled",
        before_state: existing ? JSON.stringify(existing) : undefined,
        after_state: JSON.stringify(persona),
        created_at: now,
      });

      return {
        provider_request_id: result.provider_request_id,
        output: result,
        response: {
          persona_id: persona.id,
        },
      };
    }

    if (definitionCode === "reviewer") {
      if (input.task.target_type !== "draft") {
        throw new AppError("INVALID_STATE", "reviewer target_type must be draft", {
          details: { task_id: input.task.id, target_type: input.task.target_type },
        });
      }

      const draft = await this.deps.drafts.findById(input.task.target_id);
      if (!draft) {
        throw new AppError("NOT_FOUND", "draft not found", {
          details: { draft_id: input.task.target_id },
        });
      }

      if (!draft.current_version_id) {
        throw new AppError("INVALID_STATE", "draft current_version_id is missing", {
          details: { draft_id: draft.id },
        });
      }

      const version = await this.deps.versions.findById(draft.current_version_id);
      if (!version) {
        throw new AppError("NOT_FOUND", "draft current version not found", {
          details: { version_id: draft.current_version_id },
        });
      }

      const persona = await this.deps.personas.findByAccountId(draft.account_id);
      if (!persona) {
        throw new AppError("NOT_FOUND", "persona not found", {
          details: { account_id: draft.account_id },
        });
      }

      await this.recordToolCall(artifact, input.run_id, "drafts.get_current_version", {
        draft_id: draft.id,
      }, { draft, version });
      await this.recordToolCall(artifact, input.run_id, "personas.get_current", {
        account_id: draft.account_id,
      }, persona);

      const result = await this.deps.modelGateway.reviewDraft({
        draft_id: draft.id,
        topic: draft.topic,
        content: version.content,
        persona: {
          writing_style: persona.writing_style,
          bio: persona.bio,
          interests: persona.interests,
          personality_traits: persona.personality_traits,
        },
      }, { agent_version: artifact.definition.version });

      const review = createDraftReview({
        id: newId(),
        draft_id: draft.id,
        reviewer_type: "agent",
        reviewer_id: input.run_id,
        action: result.recommendation,
        comment: result.rationale,
        created_at: this.deps.clock.now().toISOString(),
      });

      await this.deps.drafts.appendReview(review);
      await this.deps.auditLogs.append({
        id: newId(),
        workspace_id: draft.workspace_id,
        actor_type: "agent",
        actor_id: input.run_id,
        entity_type: "draft",
        entity_id: draft.id,
        action: "draft.review_generated",
        after_state: JSON.stringify(review),
        created_at: this.deps.clock.now().toISOString(),
      });

      return {
        provider_request_id: result.provider_request_id,
        output: result,
        response: {
          recommendation: result.recommendation,
        },
      };
    }

    throw new AppError("INVALID_STATE", "unsupported agent definition code", {
      details: { code: definitionCode },
    });
  }

  private async loadTrendContext(artifact: AgentArtifactBundle, runId: string, trendId: string) {
    const trend = await this.deps.trends.findById(trendId);
    if (!trend) {
      throw new AppError("NOT_FOUND", "trend not found", {
        details: { trend_id: trendId },
      });
    }

    await this.recordToolCall(artifact, runId, "trends.get_topic", { trend_id: trendId }, trend);

    return {
      topic: trend.topic,
      category: trend.category,
      score: trend.score,
    };
  }

  private async loadContentBriefContext(artifact: AgentArtifactBundle, runId: string, briefId: string) {
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

    if (!brief.topic || !brief.angle || !brief.audience || !brief.outline) {
      throw new AppError("INVALID_STATE", "content brief is missing required ready fields", {
        details: { brief_id: brief.id },
      });
    }

    await this.recordToolCall(artifact, runId, "content_briefs.get", { brief_id: brief.id }, brief);

    const evidenceItems = await this.deps.contentBriefs.listEvidenceByBriefId(brief.id);
    const documents = await this.deps.sources.listDocumentsByIds(evidenceItems.map((item) => item.source_document_id));
    const documentsById = new Map(documents.map((document) => [document.id, document]));
    const evidenceEntries = evidenceItems.flatMap((item) => {
      const document = documentsById.get(item.source_document_id);
      if (!document) {
        return [];
      }

      return [{
        item,
        document,
      }];
    });
    const evidenceDocuments = evidenceEntries.map((entry) => ({
      source_document_id: entry.document.id,
      title: entry.document.title,
      summary: entry.document.summary,
      canonical_url: entry.document.canonical_url,
      published_at: entry.document.published_at,
    }));

    if (evidenceDocuments.length === 0) {
      throw new AppError("VALIDATION_ERROR", "content brief evidence documents could not be resolved for draft generation", {
        details: {
          brief_id: brief.id,
          evidence_item_count: evidenceItems.length,
        },
      });
    }

    await this.recordToolCall(artifact, runId, "content_briefs.get_evidence", {
      brief_id: brief.id,
      evidence_count: evidenceDocuments.length,
    }, evidenceDocuments);

    return {
      brief: {
        id: brief.id,
        generation_mode: brief.generation_mode,
        topic: brief.topic,
        angle: brief.angle,
        audience: brief.audience,
        outline: brief.outline,
      },
      evidence_documents: evidenceDocuments,
      originality_guard_documents: evidenceEntries.map((entry) => ({
        source_document_id: entry.document.id,
        canonical_url: entry.document.canonical_url,
        similarity_text: buildSimilaritySourceText(
          entry.document.title,
          entry.document.summary,
          entry.document.body_text,
          entry.item.quoted_excerpt,
        ),
      })),
    };
  }

  private async loadBriefDocuments(
    artifact: AgentArtifactBundle,
    runId: string,
    input: {
      account_id: string;
      generation_mode: "from_trend" | "from_documents" | "from_source_scope";
      trend_topic?: string;
      source_scope: ContentBriefSourceScope;
      topic_hint?: string;
    },
  ) {
    if (input.source_scope.kind === "selected_documents") {
      const accountSources = await this.deps.sources.listSourcesByAccountId(input.account_id);
      const allowedSourceIds = new Set(accountSources.map((source) => source.id));
      const documents = await this.deps.sources.listDocumentsByIds(input.source_scope.source_document_ids);
      const selected = documents.filter((document) => allowedSourceIds.has(document.source_id));
      if (selected.length !== input.source_scope.source_document_ids.length) {
        throw new AppError("VALIDATION_ERROR", "source_document_ids must all resolve to documents owned by the target account", {
          details: {
            account_id: input.account_id,
            requested_count: input.source_scope.source_document_ids.length,
            resolved_count: selected.length,
          },
        });
      }

      const briefDocuments = selected.map((document) => ({
        source_document_id: document.id,
        title: normalizeBriefDocumentTitle(document.title, document.summary, document.body_text, document.canonical_url),
        summary: normalizeBriefDocumentSummary(document.summary, document.body_text, document.title),
        canonical_url: document.canonical_url,
        published_at: document.published_at,
      }));
      await this.recordToolCall(artifact, runId, "sources.get_documents", {
        account_id: input.account_id,
        source_document_ids: input.source_scope.source_document_ids,
      }, briefDocuments);
      return briefDocuments;
    }

    const scopedDocuments = await this.deps.accountSourceDocuments.listAccountSourceDocuments({
      account_id: input.account_id,
      source_ids: input.source_scope.source_ids,
      source_types: input.source_scope.source_types,
      source_status: "active",
      query: input.source_scope.query,
      published_from: input.source_scope.published_from,
      published_to: input.source_scope.published_to,
      limit: input.source_scope.limit,
    });
    const candidateDocuments = scopedDocuments.documents.map((entry) => ({
      ...entry.document,
      source_type: entry.source.type,
      source_name: entry.source.name,
    }));
    const rankingQuery = [input.trend_topic, input.topic_hint, input.source_scope.query]
      .filter((value): value is string => typeof value === "string" && value.trim() !== "")
      .join(" ")
      .trim() || undefined;
    const selection = selectDocumentsForBrief(candidateDocuments, rankingQuery, 6, {
      preferred_source_ids: input.source_scope.preferred_source_ids,
      preferred_source_types: input.source_scope.preferred_source_types,
    });
    const selected = input.generation_mode === "from_trend"
      ? selection.selected.filter((item) => item.lexical_score > 0).map((item) => item.document)
      : selection.selected.map((item) => item.document);

    if (selected.length === 0) {
      throw new AppError("NOT_FOUND", "no source documents matched the requested source_scope", {
        details: {
          account_id: input.account_id,
          generation_mode: input.generation_mode,
          source_scope: input.source_scope,
        },
      });
    }

    if (input.generation_mode === "from_trend" && selection.ranked.every((item) => item.lexical_score <= 0)) {
      throw new AppError("VALIDATION_ERROR", "no source documents matched the selected trend", {
        details: { account_id: input.account_id, trend_topic: input.trend_topic },
      });
    }

    const briefDocuments = selected.map((document) => ({
      source_document_id: document.id,
      title: normalizeBriefDocumentTitle(document.title, document.summary, document.body_text, document.canonical_url),
      summary: normalizeBriefDocumentSummary(document.summary, document.body_text, document.title),
      canonical_url: document.canonical_url,
      published_at: document.published_at,
    }));
    await this.recordToolCall(artifact, runId, "sources.list_account_documents", {
      account_id: input.account_id,
      source_scope: input.source_scope,
      selection_mode: input.generation_mode,
      ranking_query: rankingQuery,
      ranking_summary: {
        selected_count: selection.selected.length,
        top_candidates: selection.ranked.slice(0, 12).map((item) => ({
          source_document_id: item.document.id,
          source_name: item.document.source_name,
          source_type: item.document.source_type,
          lexical_score: roundMetric(item.lexical_score),
          freshness_score: roundMetric(item.freshness_score),
          preference_bonus: roundMetric(item.preference_bonus),
          diversity_bonus: roundMetric(item.diversity_bonus),
          final_score: roundMetric(item.final_score),
          selected_rank: selection.selected.findIndex((selectedItem) => selectedItem.document.id === item.document.id) + 1 || undefined,
        })),
      },
    }, briefDocuments);
    return briefDocuments;
  }

  private async runSourceBackedOriginalityGuard(
    artifact: AgentArtifactBundle,
    runId: string,
    input: {
      account_id: string;
      brief_id: string;
      draft_content: string;
      evidence_documents: Array<{
        source_document_id: string;
        canonical_url: string;
        similarity_text: string;
      }>;
    },
  ) {
    const recentDrafts = await this.deps.drafts.listRecentByAccountId(input.account_id, 8);
    const recentDraftVersions: Array<{ draft_id: string; topic: string; content: string }> = [];
    for (const draft of recentDrafts) {
      if (!draft.current_version_id) {
        continue;
      }

      const version = await this.deps.versions.findById(draft.current_version_id);
      if (!version) {
        continue;
      }

      recentDraftVersions.push({
        draft_id: draft.id,
        topic: draft.topic,
        content: version.content,
      });
    }

    const summary = evaluateSourceBackedOriginalityGuard({
      checked_at: this.deps.clock.now().toISOString(),
      draft_content: input.draft_content,
      evidence_documents: input.evidence_documents,
      recent_drafts: recentDraftVersions,
    });
    const roundedSummary = {
      ...summary,
      max_evidence_overlap: summary.max_evidence_overlap
        ? {
          ...summary.max_evidence_overlap,
          char_overlap_ratio: roundMetric(summary.max_evidence_overlap.char_overlap_ratio),
          token_overlap_ratio: roundMetric(summary.max_evidence_overlap.token_overlap_ratio),
          reused_fragment_ratio: roundMetric(summary.max_evidence_overlap.reused_fragment_ratio),
        }
        : undefined,
      max_recent_draft_overlap: summary.max_recent_draft_overlap
        ? {
          ...summary.max_recent_draft_overlap,
          char_overlap_ratio: roundMetric(summary.max_recent_draft_overlap.char_overlap_ratio),
          token_overlap_ratio: roundMetric(summary.max_recent_draft_overlap.token_overlap_ratio),
          reused_fragment_ratio: roundMetric(summary.max_recent_draft_overlap.reused_fragment_ratio),
        }
        : undefined,
    };

    await this.recordToolCall(artifact, runId, "drafts.originality_guard", {
      account_id: input.account_id,
      brief_id: input.brief_id,
      evidence_count: input.evidence_documents.length,
      recent_draft_count: recentDraftVersions.length,
    }, roundedSummary);

    assertSourceBackedOriginalityGuardPassed({
      brief_id: input.brief_id,
      summary,
    });

    return roundedSummary;
  }

  private resolveArtifact(code: string, version: string): AgentArtifactBundle {
    try {
      return getAgentArtifactBundle(code, version);
    } catch (error) {
      throw new AppError("INVALID_STATE", "agent artifact is not registered", {
        details: { code, version },
        cause: error,
      });
    }
  }

  private async recordToolCall(
    artifact: AgentArtifactBundle,
    runId: string,
    toolName: string,
    requestPayload: unknown,
    responsePayload: unknown,
  ) {
    if (!artifact.tool_policy.allowed_tools.includes(toolName)) {
      throw new AppError("MODEL_TOOL_PLAN_INVALID", "tool call is not allowed by agent tool policy", {
        details: {
          tool_name: toolName,
          tool_spec_ref: artifact.tool_policy.ref,
          allowed_tools: artifact.tool_policy.allowed_tools,
        },
      });
    }

    await this.deps.runtime.createToolCall(createToolCall({
      id: newId(),
      agent_run_id: runId,
      tool_name: toolName,
      request_payload: JSON.stringify(requestPayload),
      response_payload: JSON.stringify(responsePayload),
      status: "succeeded",
      started_at: this.deps.clock.now().toISOString(),
      finished_at: this.deps.clock.now().toISOString(),
    }));
  }

  private async persistModelArtifact(modelRequestId: string, runId: string, rawResponse: unknown): Promise<string | undefined> {
    if (typeof rawResponse !== "string" || rawResponse.trim() === "") {
      return undefined;
    }

    return this.deps.artifactStore.writeText({
      category: "model-responses",
      key: `${modelRequestId}/${runId}`,
      content: rawResponse,
      extension: "json",
    });
  }
}

function parseTaskPayload(payload: string, taskId: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(payload);
    if (!parsed || typeof parsed !== "object") {
      throw new AppError("INVALID_STATE", "agent task payload must be a JSON object", {
        details: { task_id: taskId },
      });
    }

    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError("INVALID_STATE", "agent task payload is not valid JSON", {
      cause: error,
      details: { task_id: taskId },
    });
  }
}

function resolveRunningTask(
  task: AgentTask,
  claimed: boolean | undefined,
  startedAt: string,
) {
  if (task.status === "queued") {
    return startAgentTaskExecution(task, startedAt, addMinutes(startedAt, 15));
  }

  if (claimed && task.status === "running") {
    return task;
  }

  throw new AppError("INVALID_STATE", `agent task cannot execute from status ${task.status}`, {
    details: { task_id: task.id, status: task.status, claimed: Boolean(claimed) },
  });
}

function addMinutes(isoTimestamp: string, minutes: number): string {
  return new Date(new Date(isoTimestamp).getTime() + minutes * 60_000).toISOString();
}

function selectDocumentsForBrief<T extends {
  id: string;
  source_id: string;
  source_type: Source["type"];
  source_name: string;
  canonical_url: string;
  title: string;
  summary: string;
  body_text: string;
  published_at?: string;
  created_at: string;
}>(documents: T[], query: string | undefined, limit: number, preferences?: {
  preferred_source_ids?: string[];
  preferred_source_types?: Source["type"][];
}) {
  const terms = normalizeSearchTerms(query);
  const preferredSourceIds = new Set((preferences?.preferred_source_ids ?? []).map((item) => item.trim()).filter((item) => item !== ""));
  const preferredSourceTypes = new Set((preferences?.preferred_source_types ?? []).map((item) => item.trim()).filter((item) => item !== "")) as Set<Source["type"]>;
  const newestTimestamp = documents.reduce((best, document) => {
    const timestamp = Date.parse(document.published_at ?? document.created_at);
    return Number.isFinite(timestamp) ? Math.max(best, timestamp) : best;
  }, 0);
  const ranked = documents
    .map((document) => {
      const lexicalScore = scoreDocument(document.title, document.summary, document.body_text, terms);
      const freshnessScore = scoreFreshness(document.published_at ?? document.created_at, newestTimestamp);
      const preferenceBonus = resolvePreferenceBonus(document.source_id, document.source_type, preferredSourceIds, preferredSourceTypes);
      return {
        document,
        lexical_score: lexicalScore,
        freshness_score: freshnessScore,
        preference_bonus: preferenceBonus,
        diversity_bonus: 0,
        final_score: lexicalScore + freshnessScore + preferenceBonus,
        sortKey: document.published_at ?? document.created_at,
      };
    })
    .sort((left, right) => {
      if (right.final_score !== left.final_score) {
        return right.final_score - left.final_score;
      }

      return right.sortKey.localeCompare(left.sortKey);
    });

  const selected: typeof ranked = [];
  const remaining = [...ranked];
  const seenCanonicalUrls = new Set<string>();
  while (selected.length < limit && remaining.length > 0) {
    let bestIndex = -1;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (let index = 0; index < remaining.length; index += 1) {
      const candidate = remaining[index];
      const canonicalUrl = normalizeCanonicalUrl(candidate.document.canonical_url);
      if (canonicalUrl && seenCanonicalUrls.has(canonicalUrl)) {
        continue;
      }

      const sourceAlreadySelected = selected.some((item) => item.document.source_id === candidate.document.source_id);
      const sourceTypeAlreadySelected = selected.some((item) => item.document.source_type === candidate.document.source_type);
      const preferenceBonus = resolvePreferenceBonus(candidate.document.source_id, candidate.document.source_type, preferredSourceIds, preferredSourceTypes);
      const diversityBonus = sourceAlreadySelected
        ? sourceTypeAlreadySelected
          ? 0
          : 0.35
        : 0.9;
      const finalScore = candidate.lexical_score + candidate.freshness_score + preferenceBonus + diversityBonus;

      if (finalScore > bestScore) {
        bestScore = finalScore;
        bestIndex = index;
      }
    }

    if (bestIndex === -1) {
      break;
    }

    const [candidate] = remaining.splice(bestIndex, 1);
    const selectedCandidate = {
      ...candidate,
      preference_bonus: resolvePreferenceBonus(candidate.document.source_id, candidate.document.source_type, preferredSourceIds, preferredSourceTypes),
      diversity_bonus: selected.some((item) => item.document.source_id === candidate.document.source_id)
        ? selected.some((item) => item.document.source_type === candidate.document.source_type)
          ? 0
          : 0.35
        : 0.9,
      final_score: bestScore,
    };
    selected.push(selectedCandidate);
    const canonicalUrl = normalizeCanonicalUrl(candidate.document.canonical_url);
    if (canonicalUrl) {
      seenCanonicalUrls.add(canonicalUrl);
    }
  }

  return { ranked, selected };
}

function resolvePreferenceBonus(
  sourceId: string,
  sourceType: Source["type"],
  preferredSourceIds: Set<string>,
  preferredSourceTypes: Set<Source["type"]>,
) {
  let bonus = 0;
  if (preferredSourceIds.has(sourceId)) {
    bonus += 0.8;
  }
  if (preferredSourceTypes.has(sourceType)) {
    bonus += 0.25;
  }
  return bonus;
}

function normalizeSearchTerms(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff\s]/g, " ")
    .trim();

  return normalized
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2);
}

function scoreDocument(title: string, summary: string, bodyText: string, terms: string[]): number {
  if (terms.length === 0) {
    return 0;
  }

  const titleText = title.toLowerCase();
  const haystack = `${title}\n${summary}\n${bodyText.slice(0, 1200)}`.toLowerCase();
  return terms.reduce((score, term) => {
    if (haystack.includes(term)) {
      return score + (titleText.includes(term) ? 4 : 1.5);
    }

    return score;
  }, 0);
}

function scoreFreshness(value: string, newestTimestamp: number): number {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || newestTimestamp <= 0) {
    return 0;
  }

  const ageDays = Math.max(0, (newestTimestamp - timestamp) / 86_400_000);
  return Math.max(0, 2.5 - Math.min(2.5, ageDays / 3));
}

function buildSimilaritySourceText(title: string, summary: string, bodyText: string, quotedExcerpt?: string) {
  return [title, summary, quotedExcerpt ?? "", bodyText.slice(0, 1800)].filter((value) => value.trim() !== "").join("\n");
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

function normalizeCanonicalUrl(value: string): string {
  return value.trim().toLowerCase().replace(/\/+$/, "");
}

function roundMetric(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function stripRawResponse<T extends Record<string, unknown>>(value: T): Record<string, unknown> {
  const { raw_response: _rawResponse, ...rest } = value;
  return rest;
}
