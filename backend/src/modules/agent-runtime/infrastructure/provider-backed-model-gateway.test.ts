import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../../../core/errors/app-error";
import type { ModelProvider, ModelProviderInvocation, ModelProviderResult } from "../application/ports/model-provider";
import { ProviderBackedModelGateway } from "./provider-backed-model-gateway";

class StubProvider implements ModelProvider {
  constructor(
    private readonly impl: (input: ModelProviderInvocation) => Promise<ModelProviderResult>,
    private readonly descriptor = { provider: "stub", model_name: "stub-model" },
  ) {}

  describe() {
    return this.descriptor;
  }

  invoke(input: ModelProviderInvocation): Promise<ModelProviderResult> {
    return this.impl(input);
  }
}

test("ProviderBackedModelGateway falls back to deterministic content brief on transient provider failure", async () => {
  const gateway = new ProviderBackedModelGateway(new StubProvider(async () => {
    throw new AppError("EXTERNAL_DEPENDENCY_ERROR", "provider temporarily unavailable");
  }));

  const result = await gateway.generateContentBrief({
    account_id: "account-1",
    generation_mode: "from_source_scope",
    topic_hint: "Agent tooling",
    angle_hint: "Focus on concrete execution details",
    audience: "AI builders",
    documents: [
      {
        source_document_id: "doc-1",
        title: "Codex usage keeps growing",
        summary: "Codex usage keeps growing across engineering teams. Builders are prioritizing deterministic workflows over prompt-only automation.",
        canonical_url: "https://example.com/doc-1",
      },
      {
        source_document_id: "doc-2",
        title: "Teams want reproducible automations",
        summary: "Teams want reproducible automations with strong observability and safe retries.",
        canonical_url: "https://example.com/doc-2",
      },
    ],
    persona: {
      writing_style: "direct and technical",
      bio: "builds agent systems",
      interests: ["agents", "devtools"],
      personality_traits: ["pragmatic"],
    },
  }, { agent_version: "v1" });

  assert.equal(result.topic, "Agent tooling");
  assert.equal(result.angle, "Focus on concrete execution details");
  assert.equal(result.audience, "AI builders");
  assert.match(result.outline, /Hook:/);
  assert.equal(result.evidence_items.length, 2);
  assert.equal(result.evidence_items[0]?.source_document_id, "doc-1");
  assert.match(result.rationale, /provider temporarily unavailable/);
  assert.equal(JSON.parse(result.raw_response).fallback, true);
});

test("ProviderBackedModelGateway does not hide non-fallback content brief errors", async () => {
  const gateway = new ProviderBackedModelGateway(new StubProvider(async () => ({
    provider: "stub",
    model_name: "stub-model",
    raw_text: "{}",
  })));

  await assert.rejects(() => gateway.generateContentBrief({
    account_id: "account-1",
    generation_mode: "from_source_scope",
    documents: [],
    persona: {
      writing_style: "direct",
      bio: "bio",
      interests: ["agents"],
      personality_traits: ["pragmatic"],
    },
  }, { agent_version: "v1" }), /invalid brief-builder input/);
});
