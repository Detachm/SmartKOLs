import { AppError } from "../../../core/errors/app-error";
import type { JsonSchema } from "../../../core/validation/json-schema";
import type {
  ModelProvider,
  ModelProviderDescriptor,
  ModelProviderInvocation,
  ModelProviderResult,
} from "../application/ports/model-provider";

export interface OpenAIResponsesModelProviderConfig {
  api_key: string;
  base_url: string;
  model: string;
  review_model?: string;
  request_timeout_ms: number;
  reasoning_effort?: "low" | "medium" | "high" | "xhigh";
  store?: boolean;
}

interface OpenAIErrorResponse {
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
}

interface OpenAIResponseEnvelope {
  id?: string;
  status?: string;
  error?: {
    message?: string;
  } | null;
  incomplete_details?: Record<string, unknown> | null;
  output?: Array<{
    type?: string;
    role?: string;
    content?: Array<{
      type?: string;
      text?: string;
      refusal?: string;
    }>;
  }>;
}

export class OpenAIResponsesModelProvider implements ModelProvider {
  constructor(private readonly config: OpenAIResponsesModelProviderConfig) {}

  describe(): ModelProviderDescriptor {
    return {
      provider: "openai",
      model_name: this.config.model,
    };
  }

  async invoke(input: ModelProviderInvocation): Promise<ModelProviderResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.request_timeout_ms);
    const selectedModel = this.resolveModel(input.agent_code);
    const requestBody: Record<string, unknown> = {
      model: selectedModel,
      input: [
        {
          role: "system",
          content: input.system_prompt,
        },
        {
          role: "developer",
          content: [
            input.developer_prompt,
            `Agent code: ${input.agent_code}`,
            `Prompt artifact: ${input.prompt_artifact_ref}`,
            `Tool policy: ${input.tool_spec_ref}`,
            `Allowed tools: ${input.allowed_tools.join(", ") || "none"}`,
            "Return only a JSON object that satisfies the declared schema.",
          ].join("\n"),
        },
        {
          role: "user",
          content: input.user_prompt,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: schemaNameFor(input.output_schema_ref),
          strict: true,
          schema: serializeJsonSchema(input.output_schema),
        },
      },
    };

    if (typeof this.config.store === "boolean") {
      requestBody.store = this.config.store;
    }

    if (this.config.reasoning_effort) {
      requestBody.reasoning = {
        effort: this.config.reasoning_effort,
      };
    }

    try {
      const response = await fetch(`${this.config.base_url}/responses`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.config.api_key}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      const rawText = await response.text();
      if (!response.ok) {
        throw toOpenAIHttpError(response.status, rawText);
      }

      const envelope = parseOpenAIEnvelope(rawText);
      if (envelope.error) {
        throw new AppError("EXTERNAL_DEPENDENCY_ERROR", envelope.error.message?.trim() || "OpenAI responses request failed");
      }
      if (envelope.status !== "completed") {
        throw new AppError("EXTERNAL_DEPENDENCY_ERROR", `OpenAI response did not complete successfully: ${envelope.status ?? "unknown"}`, {
          details: { incomplete_details: envelope.incomplete_details ?? undefined },
        });
      }

      const outputText = extractOutputText(envelope);
      return {
        provider: "openai",
        model_name: selectedModel,
        provider_request_id: envelope.id?.trim() || undefined,
        raw_text: outputText,
        raw_response: rawText,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new AppError("MODEL_TIMEOUT", "OpenAI responses request timed out", { cause: error });
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private resolveModel(agentCode: string): string {
    if (agentCode === "reviewer" && this.config.review_model) {
      return this.config.review_model;
    }

    return this.config.model;
  }
}

function parseOpenAIEnvelope(rawText: string): OpenAIResponseEnvelope {
  try {
    return JSON.parse(rawText) as OpenAIResponseEnvelope;
  } catch (error) {
    throw new AppError("MODEL_INVALID_OUTPUT", "OpenAI returned non-JSON response envelope", {
      cause: error,
      details: { raw_response: rawText },
    });
  }
}

function extractOutputText(envelope: OpenAIResponseEnvelope): string {
  for (const item of envelope.output ?? []) {
    if (item.type !== "message" || item.role !== "assistant") {
      continue;
    }

    for (const content of item.content ?? []) {
      if (content.type === "refusal") {
        throw new AppError("MODEL_INVALID_OUTPUT", content.refusal?.trim() || "OpenAI model refused the request");
      }

      if (content.type === "output_text" && typeof content.text === "string" && content.text.trim() !== "") {
        return content.text;
      }
    }
  }

  throw new AppError("MODEL_INVALID_OUTPUT", "OpenAI response did not contain assistant output_text");
}

function toOpenAIHttpError(status: number, rawText: string): AppError {
  const parsed = parseOpenAIError(rawText);
  const message = parsed.error?.message?.trim() || `OpenAI responses request failed with status ${status}`;

  if (status === 429) {
    return new AppError("MODEL_RATE_LIMITED", message, {
      details: { status, type: parsed.error?.type, code: parsed.error?.code },
    });
  }

  if (status >= 500) {
    return new AppError("MODEL_UPSTREAM_5XX", message, {
      details: { status, type: parsed.error?.type, code: parsed.error?.code },
    });
  }

  return new AppError("EXTERNAL_DEPENDENCY_ERROR", message, {
    details: { status, type: parsed.error?.type, code: parsed.error?.code },
  });
}

function parseOpenAIError(rawText: string): OpenAIErrorResponse {
  try {
    return JSON.parse(rawText) as OpenAIErrorResponse;
  } catch {
    return {};
  }
}

function schemaNameFor(schemaRef: string): string {
  const sanitized = schemaRef.replace(/[^A-Za-z0-9_-]/g, "_");
  return sanitized.slice(0, 64) || "agent_output";
}

function serializeJsonSchema(schema: JsonSchema): Record<string, unknown> {
  return JSON.parse(JSON.stringify(schema)) as Record<string, unknown>;
}
