import test from "node:test";
import assert from "node:assert/strict";
import { AppError } from "../../../../core/errors/app-error";
import type { ContentBrief } from "../../../content-briefs/domain/content-brief";
import { GenerateDraftFromContentBrief } from "./generate-draft-from-content-brief";

const readyBrief: ContentBrief = {
  id: "brief_1",
  workspace_id: "ws_1",
  account_id: "acct_1",
  trend_id: "trend_1",
  status: "ready",
  generation_mode: "from_documents",
  topic_hint: "source backed topic",
  topic: "source backed topic",
  angle: "clear angle",
  audience: "operators",
  outline: "outline",
  created_at: "2026-04-22T05:00:00.000Z",
  updated_at: "2026-04-22T05:00:00.000Z",
};

test("GenerateDraftFromContentBrief rejects ready briefs without evidence", async () => {
  let generateDraftCalled = false;

  const command = new GenerateDraftFromContentBrief({
    contentBriefs: {
      findBriefById: async () => readyBrief,
      listEvidenceByBriefId: async () => [],
    } as never,
    generateDraft: {
      execute: async () => {
        generateDraftCalled = true;
        return { task_id: "task_1", status: "queued" };
      },
    } as never,
  } as never);

  await assert.rejects(async () => {
    await command.execute("brief_1");
  }, (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.code, "VALIDATION_ERROR");
    assert.match(error.message, /evidence documents/);
    return true;
  });

  assert.equal(generateDraftCalled, false);
});

test("GenerateDraftFromContentBrief queues draft generation only after evidence exists", async () => {
  const calls: Array<Record<string, unknown>> = [];

  const command = new GenerateDraftFromContentBrief({
    contentBriefs: {
      findBriefById: async () => readyBrief,
      listEvidenceByBriefId: async () => [{
        id: "evidence_1",
        brief_id: "brief_1",
        source_document_id: "doc_1",
        rank: 1,
        usage_reason: "primary evidence",
        key_claims: ["claim"],
        created_at: "2026-04-22T05:01:00.000Z",
      }],
    } as never,
    generateDraft: {
      execute: async (input: Record<string, unknown>) => {
        calls.push(input);
        return { task_id: "task_1", status: "queued" };
      },
    } as never,
  } as never);

  const result = await command.execute("brief_1");

  assert.equal(result.status, "queued");
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.account_id, "acct_1");
  assert.equal(calls[0]?.content_brief_id, "brief_1");
  assert.equal(calls[0]?.trend_id, "trend_1");
});

test("GenerateDraftFromContentBrief preview metadata records explicit provenance", async () => {
  let savedVersionMetadata: Record<string, unknown> | undefined;

  const command = new GenerateDraftFromContentBrief({
    contentBriefs: {
      findBriefById: async () => readyBrief,
      listEvidenceByBriefId: async () => [{
        id: "evidence_1",
        brief_id: "brief_1",
        source_document_id: "doc_1",
        rank: 1,
        usage_reason: "primary evidence",
        key_claims: ["claim"],
        created_at: "2026-04-22T05:01:00.000Z",
      }],
    } as never,
    generateDraft: {} as never,
    accounts: {
      findById: async () => ({
        id: "acct_1",
        workspace_id: "ws_1",
      }),
    } as never,
    personas: {
      findByAccountId: async () => ({
        writing_style: "concise",
        bio: "bio",
        interests: ["ops"],
        personality_traits: ["clear"],
        distillation_sample_tweets: "sample",
      }),
    } as never,
    sources: {
      listDocumentsByIds: async () => [{
        id: "doc_1",
        title: "Doc title",
        summary: "Doc summary",
        canonical_url: "https://example.com/doc",
        published_at: "2026-04-22T04:00:00.000Z",
      }],
    } as never,
    drafts: {
      save: async () => undefined,
    } as never,
    versions: {
      create: async (version: { metadata: string }) => {
        savedVersionMetadata = JSON.parse(version.metadata) as Record<string, unknown>;
      },
    } as never,
    auditLogs: {
      append: async () => undefined,
    } as never,
    modelGateway: {
      generateDraft: async () => ({
        content: "source backed draft",
        topic: "source backed topic",
        rationale: "grounded in brief",
        provider_request_id: "provider_req_1",
      }),
    } as never,
    now: () => "2026-04-22T05:10:00.000Z",
  } as never);

  const result = await command.execute("brief_1", { preview_mode: true });

  assert.equal(result.status, "succeeded");
  assert.equal(savedVersionMetadata?.content_brief_id, "brief_1");
  assert.equal(savedVersionMetadata?.trend_id, "trend_1");
  assert.equal(savedVersionMetadata?.input_kind, "explicit_preview_request");
  assert.equal(savedVersionMetadata?.agent_run_id, null);
  assert.deepEqual(savedVersionMetadata?.evidence_document_ids, ["doc_1"]);
  assert.deepEqual(savedVersionMetadata?.source_document_ids, ["doc_1"]);
  assert.deepEqual(savedVersionMetadata?.citation_urls, ["https://example.com/doc"]);
});
