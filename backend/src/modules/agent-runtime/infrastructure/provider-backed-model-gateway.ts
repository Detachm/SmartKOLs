import { AppError } from "../../../core/errors/app-error";
import { validateJsonValue } from "../../../core/validation/json-schema";
import type {
  ContentBriefGenerationResult,
  DraftGenerationResult,
  PersonaDistillationResult,
  DraftReviewResult,
  InboxClassificationResult,
  ModelGateway,
  ReplyProposalResult,
} from "../application/ports/model-gateway";
import type { ModelProvider, ModelProviderDescriptor } from "../application/ports/model-provider";
import { normalizeModelProviderError } from "./model-error-normalizer";
import { getAgentArtifactBundle, type AgentCode } from "./static-agent-artifacts";

const MODEL_INVOKE_MAX_ATTEMPTS = 4;
const MODEL_TRANSIENT_RETRY_DELAY_MS = 750;
const MODEL_RATE_LIMIT_RETRY_DELAY_MS = 5000;

export class ProviderBackedModelGateway implements ModelGateway {
  constructor(private readonly provider: ModelProvider) {}

  describe(): ModelProviderDescriptor {
    return this.provider.describe();
  }

  async classifyInboxThread(input: {
    thread_id: string;
    channel: "mention" | "reply" | "dm" | "comment";
    messages: Array<{ sender_handle?: string; content: string; created_at: string }>;
  }, options: { agent_version: string }): Promise<InboxClassificationResult> {
    const output = await this.invokeAgent("inbox-classifier", options.agent_version, input);
    return {
      classification: requireStringEnum(
        output.classification,
        ["collab", "commerce", "spam", "normal", "support"],
        "classification",
      ),
      reasoning_summary: requireString(output.reasoning_summary, "reasoning_summary"),
      raw_response: output.raw_response,
      provider_request_id: optionalString(output.provider_request_id),
    };
  }

  async proposeReply(input: {
    thread_id: string;
    channel: "mention" | "reply" | "dm" | "comment";
    counterpart_handle?: string;
    messages: Array<{ sender_handle?: string; content: string; created_at: string }>;
  }, options: { agent_version: string }): Promise<ReplyProposalResult> {
    const output = await this.invokeAgent("reply-proposer", options.agent_version, input);
    return {
      content: requireString(output.content, "content"),
      rationale: requireString(output.rationale, "rationale"),
      raw_response: output.raw_response,
      provider_request_id: optionalString(output.provider_request_id),
    };
  }

  async generateDraft(input: {
    account_id: string;
    generation_mode: "manual_topic" | "source_backed";
    topic: string;
    trend?: {
      topic: string;
      category: string;
      score: number;
    };
    recent_documents: Array<{
      title: string;
      summary: string;
      canonical_url: string;
      published_at?: string;
    }>;
    evidence_documents?: Array<{
      source_document_id: string;
      title: string;
      summary: string;
      canonical_url: string;
      published_at?: string;
    }>;
    content_brief?: {
      brief_id: string;
      generation_mode: "from_trend" | "from_documents" | "from_source_scope";
      topic: string;
      angle: string;
      audience: string;
      outline: string;
    };
    persona: {
      writing_style: string;
      bio: string;
      interests: string[];
      personality_traits: string[];
      distillation_sample_tweets: string;
    };
  }, options: { agent_version: string }): Promise<DraftGenerationResult> {
    const output = await this.invokeAgent("writer", options.agent_version, input);
    return {
      topic: requireString(output.topic, "topic"),
      content: requireString(output.content, "content"),
      rationale: requireString(output.rationale, "rationale"),
      raw_response: output.raw_response,
      provider_request_id: optionalString(output.provider_request_id),
    };
  }

  async generateContentBrief(input: {
    account_id: string;
    generation_mode: "from_trend" | "from_documents" | "from_source_scope";
    topic_hint?: string;
    angle_hint?: string;
    audience?: string;
    trend?: {
      topic: string;
      category: string;
      score: number;
    };
    documents: Array<{
      source_document_id: string;
      title: string;
      summary: string;
      canonical_url: string;
      published_at?: string;
    }>;
    persona: {
      writing_style: string;
      bio: string;
      interests: string[];
      personality_traits: string[];
    };
  }, options: { agent_version: string }): Promise<ContentBriefGenerationResult> {
    try {
      const output = await this.invokeAgent("brief-builder", options.agent_version, input);
      return {
        topic: requireString(output.topic, "topic"),
        angle: requireString(output.angle, "angle"),
        audience: requireString(output.audience, "audience"),
        outline: requireString(output.outline, "outline"),
        rationale: requireString(output.rationale, "rationale"),
        evidence_items: requireEvidenceItems(output.evidence_items),
        raw_response: output.raw_response,
        provider_request_id: optionalString(output.provider_request_id),
      };
    } catch (error) {
      if (!(error instanceof AppError) || !shouldFallbackContentBrief(error)) {
        throw error;
      }

      return buildDeterministicContentBriefFallback(input, error);
    }
  }

  async reviewDraft(input: {
    draft_id: string;
    topic: string;
    content: string;
    persona: {
      writing_style: string;
      bio: string;
      interests: string[];
      personality_traits: string[];
    };
  }, options: { agent_version: string }): Promise<DraftReviewResult> {
    const output = await this.invokeAgent("reviewer", options.agent_version, input);
    return {
      recommendation: requireStringEnum(
        output.recommendation,
        ["approve", "reject", "request_regenerate"],
        "recommendation",
      ),
      rationale: requireString(output.rationale, "rationale"),
      raw_response: output.raw_response,
      provider_request_id: optionalString(output.provider_request_id),
    };
  }

  async distillPersona(input: {
    account_id: string;
    samples: Array<{
      kind: "post" | "reply";
      content: string;
      canonical_url?: string;
      created_at?: string;
    }>;
  }, options: { agent_version: string }): Promise<PersonaDistillationResult> {
    const normalizedInput = {
      account_id: input.account_id,
      samples: input.samples.map((sample) => ({
        kind: sample.kind,
        content: sample.content,
        ...(sample.canonical_url ? { canonical_url: sample.canonical_url } : {}),
        ...(sample.created_at ? { created_at: sample.created_at } : {}),
      })),
    };
    const output = await this.invokeAgent("persona-distiller", options.agent_version, normalizedInput);
    return {
      gender: requireString(output.gender, "gender"),
      nationality: requireString(output.nationality, "nationality"),
      age: requireInteger(output.age, "age", 1, 120),
      interests: requireStringArray(output.interests, "interests"),
      personality_traits: requireStringArray(output.personality_traits, "personality_traits"),
      writing_style: requireString(output.writing_style, "writing_style"),
      bio: requireString(output.bio, "bio"),
      distillation_sample_tweets: requireString(output.distillation_sample_tweets, "distillation_sample_tweets"),
      reasoning_summary: requireString(output.reasoning_summary, "reasoning_summary"),
      raw_response: output.raw_response,
      provider_request_id: optionalString(output.provider_request_id),
    };
  }

  private async invokeAgent(
    agentCode: AgentCode,
    agentVersion: string,
    input: unknown,
  ): Promise<Record<string, unknown> & { provider_request_id?: string; raw_response: string }> {
    const artifact = getAgentArtifactBundle(agentCode, agentVersion);
    const normalizedInput = sanitizeJsonValueForSchema(input, artifact.prompt.input_schema);
    const inputIssues = validateJsonValue(normalizedInput, artifact.prompt.input_schema);
    if (inputIssues.length > 0) {
      throw new AppError("INTERNAL_ERROR", `model gateway received invalid ${agentCode} input`, {
        details: { agent_code: agentCode, issues: inputIssues },
      });
    }

    const invokeInput = {
      agent_code: agentCode,
      prompt_artifact_ref: artifact.prompt.ref,
      tool_spec_ref: artifact.tool_policy.ref,
      input_schema_ref: artifact.prompt.input_schema_ref,
      output_schema_ref: artifact.prompt.output_schema_ref,
      system_prompt: artifact.prompt.system_prompt,
      developer_prompt: artifact.prompt.developer_prompt,
      user_prompt: JSON.stringify(normalizedInput, null, 2),
      allowed_tools: artifact.tool_policy.allowed_tools,
      output_schema: artifact.prompt.output_schema,
    } as const;

    const result = await invokeModelProviderWithRetry(
      () => this.provider.invoke(invokeInput),
      MODEL_INVOKE_MAX_ATTEMPTS,
    );

    let parsed: unknown;
    try {
      parsed = JSON.parse(result.raw_text);
    } catch (error) {
      throw new AppError("MODEL_INVALID_OUTPUT", "model provider returned non-JSON output", {
        details: {
          agent_code: agentCode,
          prompt_artifact_ref: artifact.prompt.ref,
          output_schema_ref: artifact.prompt.output_schema_ref,
        },
        cause: error,
      });
    }

    const normalizedOutput = sanitizeJsonValueForSchema(parsed, artifact.prompt.output_schema);
    const outputIssues = validateJsonValue(normalizedOutput, artifact.prompt.output_schema);
    if (outputIssues.length > 0) {
      throw new AppError("MODEL_SCHEMA_VIOLATION", "model provider output violates declared schema", {
        details: {
          agent_code: agentCode,
          prompt_artifact_ref: artifact.prompt.ref,
          output_schema_ref: artifact.prompt.output_schema_ref,
          issues: outputIssues,
        },
      });
    }

    return {
      ...asRecord(normalizedOutput),
      provider_request_id: result.provider_request_id,
      raw_response: result.raw_response ?? result.raw_text,
    };
  }
}

async function invokeModelProviderWithRetry(
  invoke: () => Promise<Awaited<ReturnType<ModelProvider["invoke"]>>>,
  maxAttempts: number,
): Promise<Awaited<ReturnType<ModelProvider["invoke"]>>> {
  let lastError: AppError | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await invoke();
    } catch (error) {
      const normalized = normalizeModelProviderError(error);
      lastError = normalized;
      if (!isRetriableModelError(normalized) || attempt === maxAttempts) {
        throw normalized;
      }

      await delay(retryDelayMsFor(normalized, attempt));
    }
  }

  throw lastError ?? new AppError("EXTERNAL_DEPENDENCY_ERROR", "model provider request failed");
}

function isRetriableModelError(error: AppError): boolean {
  return error.code === "MODEL_NETWORK_ERROR"
    || error.code === "MODEL_RATE_LIMITED"
    || error.code === "MODEL_TIMEOUT"
    || error.code === "MODEL_UPSTREAM_5XX";
}

function retryDelayMsFor(error: AppError, attempt: number): number {
  if (error.code === "MODEL_RATE_LIMITED") {
    return MODEL_RATE_LIMIT_RETRY_DELAY_MS * attempt;
  }

  return MODEL_TRANSIENT_RETRY_DELAY_MS * attempt;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new AppError("MODEL_SCHEMA_VIOLATION", "validated model output must be an object", {
      details: { value },
    });
  }

  return value as Record<string, unknown>;
}

function requireEvidenceItems(value: unknown): ContentBriefGenerationResult["evidence_items"] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new AppError("MODEL_SCHEMA_VIOLATION", "evidence_items must be a non-empty array", {
      details: { field: "evidence_items" },
    });
  }

  return value.map((item, index) => {
    const record = asRecord(item);
    return {
      source_document_id: requireString(record.source_document_id, `evidence_items[${index}].source_document_id`),
      usage_reason: requireString(record.usage_reason, `evidence_items[${index}].usage_reason`),
      key_claims: requireStringArray(record.key_claims, `evidence_items[${index}].key_claims`),
      quoted_excerpt: optionalString(record.quoted_excerpt),
    };
  });
}

function shouldFallbackContentBrief(error: AppError): boolean {
  return error.code === "EXTERNAL_DEPENDENCY_ERROR"
    || error.code === "MODEL_INVALID_OUTPUT"
    || error.code === "MODEL_SCHEMA_VIOLATION"
    || error.code === "MODEL_NETWORK_ERROR"
    || error.code === "MODEL_TIMEOUT"
    || error.code === "MODEL_UPSTREAM_5XX";
}

function buildDeterministicContentBriefFallback(input: Parameters<ModelGateway["generateContentBrief"]>[0], error: AppError): ContentBriefGenerationResult {
  const evidenceDocuments = input.documents.slice(0, Math.min(input.documents.length, 3));
  const primary = evidenceDocuments[0];
  const topic = firstNonEmpty(
    input.topic_hint,
    input.trend?.topic,
    primary?.title,
    "Current source-backed topic",
  );
  const audience = firstNonEmpty(
    input.audience,
    deriveFallbackAudience(input.persona.interests),
    "Operators following this account",
  );
  const angle = firstNonEmpty(
    input.angle_hint,
    buildFallbackAngle(topic, primary?.summary),
    `Ground the post in concrete source evidence about ${topic}.`,
  );
  const outline = buildFallbackOutline(topic, angle, evidenceDocuments);
  const rationale = `Deterministic fallback brief generated because model output was unavailable: ${error.message}`;

  return {
    topic,
    angle,
    audience,
    outline,
    rationale,
    evidence_items: evidenceDocuments.map((document, index) => ({
      source_document_id: document.source_document_id,
      usage_reason: index === 0
        ? `Use as the primary anchor for ${topic}.`
        : `Use as supporting evidence to reinforce the core angle.`,
      key_claims: extractFallbackClaims(document),
      quoted_excerpt: extractQuotedExcerpt(document.summary),
    })),
    raw_response: JSON.stringify({
      fallback: true,
      reason: error.message,
      code: error.code,
    }),
  };
}

function deriveFallbackAudience(interests: string[]): string {
  const selected = interests.map((item) => item.trim()).filter(Boolean).slice(0, 2);
  if (selected.length === 0) {
    return "Operators and builders following this account";
  }

  return `${selected.join(" / ")} builders and practitioners`;
}

function buildFallbackAngle(topic: string, summary?: string): string {
  const claim = extractSentences(summary).find((sentence) => sentence.length >= 24);
  if (claim) {
    return `${topic}: turn the strongest source-backed claim into one practical operator takeaway.`;
  }

  return `${topic}: extract one concrete takeaway that this account can explain with conviction.`;
}

function buildFallbackOutline(
  topic: string,
  angle: string,
  documents: Array<{
    source_document_id: string;
    title: string;
    summary: string;
    canonical_url: string;
    published_at?: string;
  }>,
): string {
  const bullets = [
    `Hook: state why ${topic} matters now in one sentence.`,
    `Point: explain the angle "${angle}" with 1-2 concrete details from the evidence.`,
  ];
  const supportingTitle = documents[1]?.title ?? documents[0]?.title;
  if (supportingTitle) {
    bullets.push(`Support: reference ${supportingTitle} as proof or contrast.`);
  }
  bullets.push("Close: end with one practical implication or operator takeaway.");
  return bullets.join("\n");
}

function extractFallbackClaims(document: {
  title: string;
  summary: string;
}): string[] {
  const claims = [
    document.title.trim(),
    ...extractSentences(document.summary),
  ].filter(Boolean);

  return claims.slice(0, 3);
}

function extractQuotedExcerpt(summary: string): string | undefined {
  const excerpt = extractSentences(summary)[0];
  if (!excerpt) {
    return undefined;
  }

  return excerpt.slice(0, 220);
}

function extractSentences(value?: string): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(/[\n。！？!?]+/g)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter((item) => item.length >= 12);
}

function firstNonEmpty(...values: Array<string | undefined>): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }

  return "";
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }

  return value.trim();
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new AppError("MODEL_SCHEMA_VIOLATION", `${field} must be a non-empty string`, {
      details: { field },
    });
  }

  return value.trim();
}

function requireStringEnum<T extends string>(value: unknown, choices: readonly T[], field: string): T {
  const text = requireString(value, field);
  if (!choices.includes(text as T)) {
    throw new AppError("MODEL_SCHEMA_VIOLATION", `${field} must be one of: ${choices.join(", ")}`, {
      details: { field, choices, value: text },
    });
  }

  return text as T;
}

function requireStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    throw new AppError("MODEL_SCHEMA_VIOLATION", `${field} must be an array`, {
      details: { field },
    });
  }

  const items = value.map((item, index) => requireString(item, `${field}[${index}]`));
  if (items.length === 0) {
    throw new AppError("MODEL_SCHEMA_VIOLATION", `${field} must contain at least one string`, {
      details: { field },
    });
  }

  return items;
}

function requireInteger(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new AppError("MODEL_SCHEMA_VIOLATION", `${field} must be an integer between ${min} and ${max}`, {
      details: { field, min, max, value },
    });
  }

  return value;
}

function sanitizeJsonValueForSchema(value: unknown, schema: Parameters<typeof validateJsonValue>[1]): unknown {
  if (schema.type === "object") {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return value;
    }

    const record = value as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    const properties = schema.properties ?? {};
    for (const [key, propertyValue] of Object.entries(record)) {
      if (propertyValue === undefined) {
        continue;
      }

      const propertySchema = properties[key];
      if (!propertySchema) {
        if (schema.additionalProperties === false) {
          continue;
        }
        next[key] = propertyValue;
        continue;
      }

      next[key] = sanitizeJsonValueForSchema(propertyValue, propertySchema);
    }

    return next;
  }

  if (schema.type === "array") {
    if (!Array.isArray(value) || !schema.items) {
      return value;
    }

    return value.map((item) => sanitizeJsonValueForSchema(item, schema.items!));
  }

  return value;
}
